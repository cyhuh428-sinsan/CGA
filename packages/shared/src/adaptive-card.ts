function parseJsonOrFirstObject(value: string): unknown | null {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    let depth = 0;
    let inString = false;
    let escaped = false;
    let start = -1;
    for (let index = 0; index < value.length; index += 1) {
      const char = value[index];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === "\\") {
          escaped = true;
        } else if (char === '"') {
          inString = false;
        }
        continue;
      }
      if (char === '"') {
        inString = true;
        continue;
      }
      if (char === "{" || char === "[") {
        if (depth === 0) start = index;
        depth += 1;
      } else if (char === "}" || char === "]") {
        depth -= 1;
        if (depth === 0 && start >= 0) {
          try {
            return JSON.parse(value.slice(start, index + 1)) as unknown;
          } catch {
            return null;
          }
        }
      }
    }
    return null;
  }
}
const DEFAULT_FLIGHT_RESERVATION_DATA: Record<string, unknown> = {
  underName: { name: "Sarah Hum" },
  reservationFor: {
    flightNumber: "KL605",
    departureTime: "2017-03-04T09:20:00-01:00",
    arrivalTime: "2017-03-04T12:35:00-08:00",
    departureAirport: { name: "Amsterdam Airport", iataCode: "AMS" },
    arrivalAirport: { name: "San Francisco International Airport", iataCode: "SFO" },
  },
};

function readPathValue(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[segment];
  }, source);
}

function formatTemplateTime(value: unknown) {
  const text = typeof value === "string" ? value : value == null ? "" : String(value);
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).format(date);
}

function bindTemplateString(value: string, data: Record<string, unknown>) {
  return value
    .replace(/\{\{TIME\(\$\{string\(([^)]+)\)\}\)\}\}/g, (_token, path: string) => formatTemplateTime(readPathValue(data, path.trim())))
    .replace(/\$\{string\(([^)]+)\)\}/g, (_token, path: string) => String(readPathValue(data, path.trim()) ?? ""))
    .replace(/\$\{([^}]+)\}/g, (_token, path: string) => String(readPathValue(data, path.trim()) ?? ""));
}

function bindAdaptiveCardTemplate(value: unknown, data: Record<string, unknown>): unknown {
  if (typeof value === "string") return bindTemplateString(value, data);
  if (Array.isArray(value)) return value.map((item) => bindAdaptiveCardTemplate(item, data));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, child]) => [key, bindAdaptiveCardTemplate(child, data)]),
  );
}

function hasTemplateExpression(value: unknown): boolean {
  if (typeof value === "string") return /\$\{[^}]+\}|\{\{[^}]+\}\}/.test(value);
  if (Array.isArray(value)) return value.some(hasTemplateExpression);
  if (!value || typeof value !== "object") return false;
  return Object.values(value as Record<string, unknown>).some(hasTemplateExpression);
}

function defaultTemplateDataForCard(record: Record<string, unknown>) {
  const serialized = JSON.stringify(record);
  if (serialized.includes("reservationFor.flightNumber") || serialized.includes("Your Flight Update")) {
    return DEFAULT_FLIGHT_RESERVATION_DATA;
  }
  return {};
}
export function normalizeAidotAdaptiveCard(value: unknown): Record<string, unknown> | null {
  let source = value;
  if (typeof source === "string") {
    const trimmed = source.trim();
    if (!trimmed) return null;
    try {
      source = parseJsonOrFirstObject(trimmed);
    } catch {
      return null;
    }
  }

  if (!source || typeof source !== "object" || Array.isArray(source)) return null;
  const record = source as Record<string, unknown>;
  if (record.type === "AdaptiveCard" && Array.isArray(record.body)) {
    const card = {
      $schema: "https://adaptivecards.io/schemas/adaptive-card.json",
      version: "1.6",
      ...record,
    };
    return hasTemplateExpression(card)
      ? bindAdaptiveCardTemplate(card, defaultTemplateDataForCard(card)) as Record<string, unknown>
      : card;
  }

  const readText = (target: unknown, key: string) =>
    target && typeof target === "object" && typeof (target as Record<string, unknown>)[key] === "string"
      ? String((target as Record<string, unknown>)[key])
      : "";
  const readDateTime = (target: unknown) => readText(target, "dateTime") || readText(target, "date") || readText(target, "DateTime");
  const pushFact = (facts: Array<{ title: string; value: string }>, title: string, value: unknown) => {
    const text = typeof value === "string" ? value : value == null ? "" : String(value);
    if (text.trim()) facts.push({ title, value: text });
  };

  if (record["@type"] === "FlightReservation") {
    const flight = record.reservationFor && typeof record.reservationFor === "object" ? record.reservationFor as Record<string, unknown> : {};
    const provider = flight.provider && typeof flight.provider === "object" ? flight.provider as Record<string, unknown> : {};
    const departure = flight.departureAirport && typeof flight.departureAirport === "object" ? flight.departureAirport as Record<string, unknown> : {};
    const arrival = flight.arrivalAirport && typeof flight.arrivalAirport === "object" ? flight.arrivalAirport as Record<string, unknown> : {};
    const passenger = record.underName && typeof record.underName === "object" ? record.underName as Record<string, unknown> : {};
    const facts: Array<{ title: string; value: string }> = [];
    pushFact(facts, "Passenger", readText(passenger, "name"));
    pushFact(facts, "Reservation", record.reservationId);
    pushFact(facts, "Flight", `${readText(provider, "iataCode") || readText(provider, "name")} ${String(flight.flightNumber || "")}`.trim());
    pushFact(facts, "From", `${readText(departure, "name")} ${readText(departure, "iataCode")}`.trim());
    pushFact(facts, "To", `${readText(arrival, "name")} ${readText(arrival, "iataCode")}`.trim());
    pushFact(facts, "Departure", flight.departureTime);
    pushFact(facts, "Arrival", flight.arrivalTime);
    return {
      $schema: "https://adaptivecards.io/schemas/adaptive-card.json",
      type: "AdaptiveCard",
      version: "1.6",
      body: [
        { type: "TextBlock", text: "Flight Reservation", size: "Large", weight: "Bolder", wrap: true },
        { type: "FactSet", spacing: "Medium", facts },
      ],
    };
  }

  if (typeof record.summary === "string" && (record.start || record.end || record.location)) {
    const organizer = record.organizer && typeof record.organizer === "object" ? record.organizer as Record<string, unknown> : {};
    const facts: Array<{ title: string; value: string }> = [];
    pushFact(facts, "Location", record.location);
    pushFact(facts, "Start", readDateTime(record.start));
    pushFact(facts, "End", readDateTime(record.end));
    pushFact(facts, "Organizer", readText(organizer, "displayName") || readText(organizer, "email"));
    return {
      $schema: "https://adaptivecards.io/schemas/adaptive-card.json",
      type: "AdaptiveCard",
      version: "1.6",
      body: [
        { type: "TextBlock", text: record.summary, size: "Large", weight: "Bolder", wrap: true },
        { type: "FactSet", spacing: "Medium", facts },
      ],
      actions: typeof record.htmlLink === "string" ? [{ type: "Action.OpenUrl", title: "Open Event", url: record.htmlLink }] : [],
    };
  }

  if (typeof record.Subject === "string" || typeof record.BodyPreview === "string") {
    const start = record.Start && typeof record.Start === "object" ? record.Start as Record<string, unknown> : {};
    const end = record.End && typeof record.End === "object" ? record.End as Record<string, unknown> : {};
    const location = record.Location && typeof record.Location === "object" ? record.Location as Record<string, unknown> : {};
    const organizerSource = record.Organizer && typeof record.Organizer === "object" ? record.Organizer as Record<string, unknown> : {};
    const organizer = organizerSource.EmailAddress && typeof organizerSource.EmailAddress === "object" ? organizerSource.EmailAddress as Record<string, unknown> : organizerSource;
    const facts: Array<{ title: string; value: string }> = [];
    pushFact(facts, "Location", readText(location, "DisplayName") || record.Location);
    pushFact(facts, "Start", readText(start, "DateTime"));
    pushFact(facts, "End", readText(end, "DateTime"));
    pushFact(facts, "Organizer", readText(organizer, "Name") || readText(organizer, "Address"));
    return {
      $schema: "https://adaptivecards.io/schemas/adaptive-card.json",
      type: "AdaptiveCard",
      version: "1.6",
      body: [
        { type: "TextBlock", text: String(record.Subject || "Outlook Event"), size: "Large", weight: "Bolder", wrap: true },
        ...(typeof record.BodyPreview === "string" ? [{ type: "TextBlock", text: record.BodyPreview, wrap: true, spacing: "Small" }] : []),
        { type: "FactSet", spacing: "Medium", facts },
      ],
      actions: typeof record.WebLink === "string" ? [{ type: "Action.OpenUrl", title: "Open Event", url: record.WebLink }] : [],
    };
  }

  const title = typeof record.title === "string" ? record.title : typeof record.summary === "string" ? record.summary : typeof record.Subject === "string" ? record.Subject : "Adaptive Card";
  const description = typeof record.description === "string" ? record.description : typeof record.BodyPreview === "string" ? record.BodyPreview : "";
  const creator = record.creator && typeof record.creator === "object" ? record.creator as Record<string, unknown> : null;
  const creatorName = creator && typeof creator.name === "string" ? creator.name : "";
  const creatorImage = creator && typeof creator.profileImage === "string" ? creator.profileImage : "";
  const properties = Array.isArray(record.properties)
    ? record.properties.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    : [];
  const viewUrl = typeof record.viewUrl === "string" ? record.viewUrl : "";

  const body: Record<string, unknown>[] = [
    {
      type: "TextBlock",
      text: title,
      size: "Large",
      weight: "Bolder",
      wrap: true,
    },
  ];

  if (description) {
    body.push({ type: "TextBlock", text: description, wrap: true, spacing: "Small" });
  }

  if (creatorName || creatorImage) {
    body.push({
      type: "ColumnSet",
      spacing: "Medium",
      columns: [
        creatorImage
          ? {
              type: "Column",
              width: "auto",
              items: [{ type: "Image", url: creatorImage, style: "Person", width: "32px" }],
            }
          : { type: "Column", width: "auto", items: [] },
        {
          type: "Column",
          width: "stretch",
          verticalContentAlignment: "Center",
          items: [{ type: "TextBlock", text: creatorName || "Creator", wrap: true, weight: "Bolder" }],
        },
      ],
    });
  }

  if (properties.length > 0) {
    body.push({
      type: "FactSet",
      spacing: "Medium",
      facts: properties.map((item) => ({
        title: String(item.key ?? item.title ?? item.name ?? ""),
        value: String(item.value ?? item.text ?? ""),
      })),
    });
  }

  return {
    $schema: "https://adaptivecards.io/schemas/adaptive-card.json",
    type: "AdaptiveCard",
    version: "1.6",
    body,
    actions: viewUrl ? [{ type: "Action.OpenUrl", title: "View Details", url: viewUrl }] : [],
  };
}




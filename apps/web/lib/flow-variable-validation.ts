function normalizeVariableName(value: string) {
  return value.trim().replace(/^\$+/, "").trim().toLowerCase();
}

export function hasDuplicateVariableNames(variableNames: string[]) {
  const namesInCard = new Set<string>();

  for (const variableName of variableNames) {
    const normalizedName = normalizeVariableName(variableName);
    if (!normalizedName) {
      continue;
    }
    if (namesInCard.has(normalizedName)) {
      return true;
    }
    namesInCard.add(normalizedName);
  }

  return false;
}

export function shouldValidateVariableReferences(dialogType: 0 | 1) {
  return dialogType === 1;
}

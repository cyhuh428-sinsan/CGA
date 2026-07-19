import Link from "next/link";

type SortDirection = "none" | "asc" | "desc";

type SortHeaderLabelProps = {
  label: string;
  href?: string;
  direction?: SortDirection;
  className?: string;
};

export function SortHeaderLabel({
  label,
  href,
  direction = "none",
  className = "",
}: SortHeaderLabelProps) {
  const classes = `sort-header${href ? " sort-header--interactive" : ""}${className ? ` ${className}` : ""}`;

  const content = (
    <>
      <span className="sort-header__text">{label}</span>
      <span className={`sort-header__icon sort-header__icon--${direction}`} aria-hidden="true">
        <span className="sort-header__bars">
          <span />
          <span />
        </span>
        <span className="sort-header__arrow sort-header__arrow--up" />
        <span className="sort-header__arrow sort-header__arrow--down" />
      </span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    );
  }

  return <span className={classes}>{content}</span>;
}

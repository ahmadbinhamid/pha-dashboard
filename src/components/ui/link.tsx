import { Link as RouterLink, type LinkProps } from "react-router-dom";

type AppLinkProps = {
  href: string;
  children?: React.ReactNode;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
  title?: string;
  "aria-label"?: string;
  [key: string]: unknown;
};

export default function Link({ href, ...rest }: AppLinkProps) {
  return <RouterLink to={href} {...(rest as Omit<LinkProps, "to">)} />;
}

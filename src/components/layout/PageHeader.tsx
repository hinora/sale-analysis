import { Box, Typography, Breadcrumbs, Link as MuiLink } from "@mui/material";
import Link from "next/link";
import { NavigateNext as NavigateNextIcon } from "@mui/icons-material";

/**
 * Reusable page header component with breadcrumbs
 * Props:
 * - title: Main page title
 * - subtitle: Optional description text
 * - breadcrumbs: Array of { label, href } for navigation
 */
export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
}

export default function PageHeader({
  title,
  subtitle,
  breadcrumbs,
}: PageHeaderProps) {
  return (
    <Box sx={{ mb: 4 }}>
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumbs
          separator={<NavigateNextIcon fontSize="small" />}
          sx={{ mb: 2 }}
        >
          {breadcrumbs.map((crumb) => {
            const isLast = crumb === breadcrumbs[breadcrumbs.length - 1];

            if (isLast || !crumb.href) {
              return (
                <Typography
                  key={crumb.label}
                  color="text.primary"
                  fontSize="0.875rem"
                >
                  {crumb.label}
                </Typography>
              );
            }

            return (
              <MuiLink
                key={crumb.label}
                component={Link}
                href={crumb.href}
                color="inherit"
                fontSize="0.875rem"
                sx={{
                  cursor: "pointer",
                  textDecoration: "none",
                  "&:hover": {
                    textDecoration: "underline",
                  },
                }}
              >
                {crumb.label}
              </MuiLink>
            );
          })}
        </Breadcrumbs>
      )}

      {/* Title */}
      <Typography variant="h4" component="h1" gutterBottom fontWeight={600}>
        {title}
      </Typography>

      {/* Subtitle */}
      {subtitle && (
        <Typography variant="body1" color="text.secondary">
          {subtitle}
        </Typography>
      )}
    </Box>
  );
}

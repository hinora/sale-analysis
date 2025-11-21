import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Button,
  Container,
} from '@mui/material';
import {
  UploadFile as UploadIcon,
  Search as SearchIcon,
  Category as CategoryIcon,
  Business as BusinessIcon,
  Psychology as AIIcon,
} from '@mui/icons-material';

/**
 * Main navigation component with links to all features
 * Features:
 * - Active route highlighting
 * - Responsive design
 * - Icon + text navigation
 */
export default function Navigation() {
  const router = useRouter();

  const navItems = [
    { label: 'Nhập CSV', href: '/import', icon: <UploadIcon /> },
    { label: 'Tra cứu giao dịch', href: '/transactions', icon: <SearchIcon /> },
    { label: 'Danh mục hàng hóa', href: '/goods', icon: <CategoryIcon /> },
    { label: 'Phân tích công ty', href: '/companies', icon: <BusinessIcon /> },
    { label: 'AI Phân tích', href: '/ai-analysis', icon: <AIIcon /> },
  ];

  return (
    <AppBar position="sticky" elevation={1}>
      <Container maxWidth="xl">
        <Toolbar disableGutters>
          {/* Logo/Brand */}
          <Typography
            variant="h6"
            component={Link}
            href="/"
            sx={{
              flexGrow: 0,
              fontWeight: 700,
              letterSpacing: '.1rem',
              color: 'white',
              cursor: 'pointer',
              mr: 4,
              textDecoration: 'none',
              '&:hover': {
                opacity: 0.9,
              },
            }}
          >
            Export Goods Analysis
          </Typography>

          {/* Navigation Links */}
          <Box sx={{ flexGrow: 1, display: 'flex', gap: 1 }}>
            {navItems.map((item) => {
              const isActive = router.pathname === item.href;
              return (
                <Button
                  key={item.href}
                  component={Link}
                  href={item.href}
                  startIcon={item.icon}
                  sx={{
                    color: 'white',
                    backgroundColor: isActive ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    },
                    fontWeight: isActive ? 600 : 400,
                    textDecoration: 'none',
                  }}
                >
                  {item.label}
                </Button>
              );
            })}
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
}

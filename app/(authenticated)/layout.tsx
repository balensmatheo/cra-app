"use client";
import { CRAProvider, useCRA } from '@/context/CRAContext';
import Navbar from '@/components/Navbar';
import Box from '@mui/material/Box';

function LayoutShell({ children }: { children: React.ReactNode }) {
	const { isFullscreen } = useCRA();
	return (
		<Box sx={{ minHeight: '100vh', background: '#f5f5f5' }}>
			{!isFullscreen && <Navbar />}
			<Box sx={{ minHeight: isFullscreen ? '100vh' : 'calc(100vh - 72px)' }}>
				{children}
			</Box>
		</Box>
	);
}

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
	return (
		<CRAProvider>
			<LayoutShell>{children}</LayoutShell>
		</CRAProvider>
	);
}

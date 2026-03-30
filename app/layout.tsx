import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import OfflineRuntime from "./components/OfflineRuntime";
import PWARegister from "./components/PWARegister";

const geistSans = Geist({
 variable: "--font-geist-sans",
 subsets: ["latin"],
});

const geistMono = Geist_Mono({
 variable: "--font-geist-mono",
 subsets: ["latin"],
});

export const metadata: Metadata = {
 title: "SPORT — Votre coach personnel",
 description: "Plateforme sociale de fitness - Entraînez-vous, testez votre niveau, jouez et compétitionnez avec vos amis.",
 applicationName: "SPORT",
 manifest: "/manifest.json",
 appleWebApp: {
 capable: true,
 statusBarStyle: "black-translucent",
 title: "SPORT",
 },
 formatDetection: {
 email: false,
 address: false,
 telephone: false,
 },
 icons: {
 icon: "/icon-192.svg",
 apple: "/icon-192.svg",
 },
};

export const viewport: Viewport = {
 width: "device-width",
 initialScale: 1,
 viewportFit: "cover",
 userScalable: false,
 themeColor: "#000000",
};

export default function RootLayout({
 children,
}: Readonly<{
 children: React.ReactNode;
}>) {
 return (
 <html
	 lang="en"
	 className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
 >
	 <body className="min-h-full flex flex-col ios-screen">
		 <OfflineRuntime />
		 <PWARegister />
		 <header className="w-full flex flex-col items-center py-6 select-none">
			 <img
				 src="/logo-levelflow.jpg"
				 alt="Levelflow logo"
				 className="w-16 h-16 rounded-full shadow-md mb-2 object-cover"
				 style={{ background: '#fff' }}
			 />
			 <span className="text-xl font-extrabold tracking-tight text-gray-900">Levelflow</span>
		 </header>
		 {children}
	 </body>
 </html>
 );
}

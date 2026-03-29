import type { Metadata } from "next";
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
 themeColor: "#000000",
 viewport: "width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no",
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
 {children}
 </body>
 </html>
 );
}

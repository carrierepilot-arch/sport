import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminPermission } from '@/lib/admin-auth';
import { getProfileImageUrl, getProfileVisibility } from '@/lib/social';

export async function GET(request: NextRequest) {
 try {
 const admin = await requireAdminPermission(request, 'users:read');
 if (!admin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

 let users: Array<{
 id: string;
 email: string;
 name: string | null;
 pseudo: string | null;
 isAdmin: boolean;
 adminLevel: number;
 suspended: boolean;
 level: string;
 equipmentData?: unknown;
 createdAt: Date;
 updatedAt: Date;
 sessions: { lastSeen: Date; browser: string | null; device: string | null; ipAddress: string | null; createdAt: Date }[];
 _count: { sentMessages: number; sentFriendRequests: number; receivedFriendRequests: number; activityLogs: number };
 }>;

 try {
 users = await prisma.user.findMany({
 select: {
 id: true,
 email: true,
 name: true,
 pseudo: true,
 isAdmin: true,
 adminLevel: true,
 suspended: true,
 level: true,
 equipmentData: true,
 createdAt: true,
 updatedAt: true,
 sessions: {
 orderBy: { lastSeen: 'desc' },
 take: 1,
 select: { lastSeen: true, browser: true, device: true, ipAddress: true, createdAt: true },
 },
 _count: {
 select: {
 sentMessages: true,
 sentFriendRequests: true,
 receivedFriendRequests: true,
 activityLogs: true,
 },
 },
 },
 orderBy: { createdAt: 'desc' },
 });
 } catch {
 // Fallback for databases missing newer columns (level/suspended/updatedAt).
 const legacyUsers = await prisma.user.findMany({
 select: {
 id: true,
 email: true,
 name: true,
 pseudo: true,
 isAdmin: true,
 equipmentData: true,
 createdAt: true,
 sessions: {
 orderBy: { lastSeen: 'desc' },
 take: 1,
 select: { lastSeen: true, browser: true, device: true, ipAddress: true, createdAt: true },
 },
 _count: {
 select: {
 sentMessages: true,
 sentFriendRequests: true,
 receivedFriendRequests: true,
 activityLogs: true,
 },
 },
 },
 orderBy: { createdAt: 'desc' },
 });

 users = legacyUsers.map((u) => ({
 ...u,
 adminLevel: u.isAdmin ? 3 : 0,
 suspended: false,
 level: 'intermediaire',
 updatedAt: u.createdAt,
 }));
 }

 const usersWithProfile = users.map((user) => ({
 ...user,
 profileImageUrl: getProfileImageUrl(user.equipmentData),
 profileVisibility: getProfileVisibility(user.equipmentData),
 }));

 return NextResponse.json({ users: usersWithProfile });
 } catch (error) {
 console.error('Admin users error:', error);
 return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
 }
}

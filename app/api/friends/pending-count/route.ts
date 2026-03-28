import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
 try {
 const token = request.headers.get('authorization')?.replace('Bearer ', '');
 if (!token) return NextResponse.json({ count: 0 });
 const payload = verifyToken(token);
 if (!payload) return NextResponse.json({ count: 0 });

 const count = await prisma.friendRequest.count({
 where: { receiverId: payload.userId, status: 'pending' },
 });

 return NextResponse.json({ count });
 } catch {
 return NextResponse.json({ count: 0 });
 }
}

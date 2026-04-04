import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAdminAction, requireAdminPermission } from '@/lib/admin-auth';
import { getProfileImageUrl, withProfileImageUrl, withoutProfileImageUrl } from '@/lib/social';
import type { Prisma } from '@/lib/generated/prisma/client';

// Helper: masquer l'email si admin < niveau 3
function sanitizeUser(user: any, adminLevel: number) {
 if (adminLevel < 3) {
 const { email, ...rest } = user;
 return rest;
 }
 return user;
}

// PATCH — suspend/unsuspend a user OR toggle admin
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
 try {
 const admin = await requireAdminPermission(request, 'users:write');
 if (!admin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

 // Seulement les admins niveau 3 peuvent effectuer ces opérations
 if (admin.adminLevel < 3) {
 return NextResponse.json({ error: 'Vous n\'avez pas l\'accès à cette opération (niveau 3 requis)' }, { status: 403 });
 }

 const { id } = await params;
 const body = await request.json();

 const target = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, isAdmin: true, equipmentData: true } });
 if (!target) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });

 // ── Moderate identity/photo ──
 if (
	 typeof body.pseudo === 'string' ||
	 typeof body.name === 'string' ||
	 typeof body.profileImageUrl === 'string' ||
	 typeof body.removeProfileImage === 'boolean'
 ) {
	 const data: Prisma.UserUpdateInput = {};
	 if (typeof body.pseudo === 'string') {
		 const pseudo = body.pseudo.trim();
		 if (!pseudo) return NextResponse.json({ error: 'Pseudo invalide' }, { status: 400 });
		 const duplicate = await prisma.user.findFirst({
			 where: {
				 id: { not: id },
				 pseudo: { equals: pseudo, mode: 'insensitive' },
			 },
			 select: { id: true },
		 });
		 if (duplicate) return NextResponse.json({ error: 'Pseudo deja utilise' }, { status: 409 });
		 data.pseudo = pseudo;
	 }
	 if (typeof body.name === 'string') {
		 const name = body.name.trim();
		 data.name = name || null;
	 }
	 if (body.removeProfileImage === true) {
		 data.equipmentData = withoutProfileImageUrl(target.equipmentData) as Prisma.InputJsonValue;
	 } else if (typeof body.profileImageUrl === 'string') {
		 const url = body.profileImageUrl.trim();
		 if (!url) {
			 data.equipmentData = withoutProfileImageUrl(target.equipmentData) as Prisma.InputJsonValue;
		 } else {
			 data.equipmentData = withProfileImageUrl(target.equipmentData, url) as Prisma.InputJsonValue;
		 }
	 }

	 const updated = await prisma.user.update({
		 where: { id },
		 data,
		 select: { id: true, email: true, name: true, pseudo: true, equipmentData: true, isAdmin: true, adminLevel: true, suspended: true },
	 });

	 await logAdminAction(admin.userId, 'admin.user.profile_moderation', `user=${target.email} pseudo=${String(updated.pseudo)} name=${String(updated.name)} removePhoto=${String(body.removeProfileImage === true)}`);

	 return NextResponse.json({
		 user: sanitizeUser({
			 ...updated,
			 profileImageUrl: getProfileImageUrl(updated.equipmentData),
		 }, admin.adminLevel),
	 });
 }

 // ── Toggle isAdmin ──
 if (typeof body.isAdmin === 'boolean') {
 if (id === admin.userId) {
 return NextResponse.json({ error: 'Vous ne pouvez pas modifier vos propres droits admin' }, { status: 400 });
 }
 const updated = await prisma.user.update({
 where: { id },
 data: { isAdmin: body.isAdmin, adminLevel: body.isAdmin ? 1 : 0 },
 select: { id: true, email: true, isAdmin: true, adminLevel: true, suspended: true },
 });
 await logAdminAction(admin.userId, 'admin.user.admin_toggle', `${target.email} -> isAdmin=${String(body.isAdmin)}`);
 return NextResponse.json({ user: sanitizeUser(updated, admin.adminLevel) });
 }

 // ── Change admin level ──
 if (typeof body.adminLevel === 'number') {
 if (id === admin.userId) {
 return NextResponse.json({ error: 'Vous ne pouvez pas modifier votre propre niveau admin' }, { status: 400 });
 }
 if (!target.isAdmin) {
 return NextResponse.json({ error: 'Le niveau admin ne peut être changé que pour un administrateur' }, { status: 400 });
 }
 const level = Math.max(1, Math.min(3, Math.trunc(Number(body.adminLevel))));
 const updated = await prisma.user.update({
 where: { id },
 data: { adminLevel: level },
 select: { id: true, email: true, isAdmin: true, adminLevel: true, suspended: true },
 });
 await logAdminAction(admin.userId, 'admin.user.level_change', `${target.email} -> adminLevel=${String(level)}`);
 return NextResponse.json({ user: sanitizeUser(updated, admin.adminLevel) });
 }

 // ── Toggle suspended ──
 if (typeof body.suspended === 'boolean') {
 if (id === admin.userId) {
 return NextResponse.json({ error: 'Vous ne pouvez pas vous suspendre vous-même' }, { status: 400 });
 }
 if (target.isAdmin) {
 return NextResponse.json({ error: 'Impossible de suspendre un administrateur' }, { status: 400 });
 }
 const updated = await prisma.user.update({
 where: { id },
 data: { suspended: body.suspended },
 select: { id: true, email: true, suspended: true },
 });
 await logAdminAction(admin.userId, 'admin.user.suspend_toggle', `${target.email} -> suspended=${String(body.suspended)}`);
 return NextResponse.json({ user: sanitizeUser(updated, admin.adminLevel) });
 }

 return NextResponse.json({ error: 'Champ "suspended" | "isAdmin" | "adminLevel" requis' }, { status: 400 });
 } catch (error) {
 console.error('Admin PATCH user error:', error);
 return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
 }
}

// DELETE — delete a user and all their data
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
 try {
 const admin = await requireAdminPermission(request, 'users:write');
 if (!admin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

 // Seulement les admins niveau 3 peuvent supprimer des utilisateurs
 if (admin.adminLevel < 3) {
 return NextResponse.json({ error: 'Vous n\'avez pas l\'accès à cette opération (niveau 3 requis)' }, { status: 403 });
 }

 const { id } = await params;

 // Prevent self-deletion
 if (id === admin.userId) {
 return NextResponse.json({ error: 'Vous ne pouvez pas supprimer votre propre compte' }, { status: 400 });
 }

 const target = await prisma.user.findUnique({ where: { id } });
 if (!target) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
 // Only protect level-3 admins from deletion; level 1/2 admins can be deleted
 if ((target.adminLevel ?? 0) >= 3) return NextResponse.json({ error: 'Impossible de supprimer un administrateur de niveau 3' }, { status: 400 });

 // Collect owned resource IDs needed for cross-user cleanup (cannot be done inside batch transaction)
 const [ownedWorkouts, ownedGroups] = await Promise.all([
   prisma.workout.findMany({ where: { userId: id }, select: { id: true } }),
   prisma.group.findMany({ where: { ownerId: id }, select: { id: true } }),
 ]);
 const workoutIds = ownedWorkouts.map(w => w.id);
 const ownedGroupIds = ownedGroups.map(g => g.id);

 // Delete all related data then the user using an interactive transaction for safe ordering
 await prisma.$transaction(async (tx) => {
   // Spots
   await tx.spot.updateMany({ where: { addedBy: id }, data: { addedBy: null } });
   await tx.spotRegular.deleteMany({ where: { userId: id } });
   await tx.spotFavorite.deleteMany({ where: { userId: id } });
   // Challenges
   await tx.challenge.updateMany({ where: { creatorId: id }, data: { creatorId: null } });
   await tx.challengeCompletion.deleteMany({ where: { userId: id } });
   // Performances: delete validations from this user as validator + validations on their performances
   await tx.performanceValidation.deleteMany({ where: { validatorId: id } });
   await tx.performanceValidation.deleteMany({ where: { performance: { userId: id } } });
   await tx.performance.deleteMany({ where: { userId: id } });
   // Groups: clean this user's messages/memberships in all groups
   await tx.groupMessage.deleteMany({ where: { userId: id } });
   await tx.groupMember.deleteMany({ where: { userId: id } });
   // Clean remaining members/messages in groups owned by this user, then delete those groups
   if (ownedGroupIds.length > 0) {
     await tx.groupMessage.deleteMany({ where: { groupId: { in: ownedGroupIds } } });
     await tx.groupMember.deleteMany({ where: { groupId: { in: ownedGroupIds } } });
   }
   await tx.group.deleteMany({ where: { ownerId: id } });
   // Misc data
   await tx.apiLog.deleteMany({ where: { userId: id } });
   await tx.badge.deleteMany({ where: { userId: id } });
   await tx.activityLog.deleteMany({ where: { userId: id } });
   await tx.userSession.deleteMany({ where: { userId: id } });
   await tx.message.deleteMany({ where: { OR: [{ senderId: id }, { receiverId: id }] } });
   await tx.friendRequest.deleteMany({ where: { OR: [{ senderId: id }, { receiverId: id }] } });
   // Workouts: delete all sessions referencing this user's workouts (from any user), then their sessions elsewhere
   if (workoutIds.length > 0) {
     await tx.workoutSession.deleteMany({ where: { workoutId: { in: workoutIds } } });
   }
   await tx.workoutSession.deleteMany({ where: { userId: id } });
   await tx.workout.deleteMany({ where: { userId: id } });
   // Finally delete the user
   await tx.user.delete({ where: { id } });
 });

 await logAdminAction(admin.userId, 'admin.user.delete', `Deleted user ${target.email} (${id})`);

 return NextResponse.json({ success: true });
 } catch (error) {
 console.error('Admin delete user error:', error);
 return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
 }
}

import { NextRequest, NextResponse } from 'next/server';
import { getAdminControlConfig, getSectionByPath } from '@/lib/admin-control-config';

export async function GET(request: NextRequest) {
  const config = await getAdminControlConfig();
  const url = new URL(request.url);
  const path = (url.searchParams.get('path') || '').trim();

  const sections = Object.values(config.sections).map((section) => ({
    key: section.key,
    label: section.label,
    paths: section.paths,
    status: section.status,
    hidden: section.status === 'hidden',
    maintenanceMessage: section.maintenanceMessage,
    updatedAt: section.updatedAt,
  }));

  if (path) {
    const current = await getSectionByPath(path);
    return NextResponse.json({
      sections,
      current: current
        ? {
            key: current.key,
            status: current.status,
            maintenanceMessage: current.maintenanceMessage,
          }
        : null,
      updatedAt: config.updatedAt,
    });
  }

  return NextResponse.json({ sections, updatedAt: config.updatedAt });
}

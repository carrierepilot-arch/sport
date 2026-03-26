import Link from 'next/link';

const CARDS = [
  {
    href:    '/dashboard/profil',
    label:   'Profil',
    desc:    'Informations personnelles, pseudo et objectifs sportifs',
    action:  'Gerer mon profil',
    border:  'hover:border-blue-500',
    text:    'text-blue-600',
    icon:    'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    bg:      'bg-blue-50',
  },
  {
    href:    '/dashboard/entrainement',
    label:   'Entrainement',
    desc:    'Configurez vos seances, objectifs, equipement et generez un programme',
    action:  'Configurer',
    border:  'hover:border-emerald-500',
    text:    'text-emerald-600',
    icon:    'M13 10V3L4 14h7v7l9-11h-7z',
    bg:      'bg-emerald-50',
  },
  {
    href:    '/dashboard/reseau',
    label:   'Reseau',
    desc:    'Amis, messagerie privee et groupes d\'entrainement',
    action:  'Voir le reseau',
    border:  'hover:border-violet-500',
    text:    'text-violet-600',
    icon:    'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
    bg:      'bg-violet-50',
  },
  {
    href:    '/dashboard/analyse',
    label:   'Analyse',
    desc:    'Statistiques de performance, progression et respect des objectifs',
    action:  'Voir les stats',
    border:  'hover:border-amber-500',
    text:    'text-amber-600',
    icon:    'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    bg:      'bg-amber-50',
  },
];

export default function DashboardPage() {
  return (
    <main className="flex-1 px-4 py-6 sm:px-8 sm:py-10 max-w-5xl">
      {/* Header */}
      <div className="mb-8 sm:mb-10">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Tableau de bord</h1>
        <p className="text-gray-500 mt-1">Bonjour. Que souhaitez-vous faire aujourd'hui ?</p>
      </div>

      {/* KPIs rapides */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-8 sm:mb-10">
        {[
          { label: 'Seances cette semaine', value: '4' },
          { label: 'Temps total',           value: '3h15' },
          { label: 'Objectif actuel',       value: 'Force' },
        ].map((k) => (
          <div key={k.label} className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="text-2xl font-bold text-gray-900 tabular-nums">{k.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Cards navigation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CARDS.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className={`group bg-white border-2 border-gray-200 ${c.border} rounded-xl p-6 flex flex-col gap-4 hover:shadow-md transition-all`}
          >
            <div className={`w-10 h-10 ${c.bg} rounded-lg flex items-center justify-center`}>
              <svg className={`w-5 h-5 ${c.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d={c.icon} />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-gray-900 mb-1">{c.label}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{c.desc}</p>
            </div>
            <span className={`text-sm font-medium ${c.text} group-hover:translate-x-0.5 transition-transform inline-block`}>
              {c.action} &rarr;
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}

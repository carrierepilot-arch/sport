import Link from "next/link";

export default function Home() {
 return (
 <div className="ios-screen min-h-screen text-gray-900 flex flex-col">
 {/* NAV */}
 <nav className="sticky top-0 z-20 ios-nav-glass flex justify-between items-center px-4 sm:px-8 py-4">
 <Link href="/">
 <img src="/logo-levelflow.jpg" alt="Levelflow" className="h-9 w-auto object-contain" />
 </Link>
 <div className="flex gap-2 sm:gap-3">
 <Link href="/login" className="px-4 sm:px-5 py-2 text-sm font-semibold text-gray-700 border border-gray-300 rounded-full hover:bg-white transition">
 Se connecter
 </Link>
 <Link href="/register" className="px-4 sm:px-5 py-2 text-sm font-semibold bg-sky-500 text-white rounded-full hover:bg-sky-600 transition shadow-[0_8px_18px_rgba(2,132,199,0.35)]">
 S&apos;inscrire
 </Link>
 </div>
 </nav>

 {/* HERO */}
 <main className="flex-1 px-5 sm:px-8 pb-14 pt-8 md:pt-12 max-w-6xl mx-auto w-full">
 <section className="ios-card p-6 sm:p-8 md:p-10 mb-6 sm:mb-8">
 <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.16em] text-sky-700">Reseau social street workout</p>
 <h1 className="mt-3 text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[0.95]">
 L app pour performer,
 <span className="block text-transparent bg-clip-text bg-gradient-to-r from-sky-500 to-teal-500">
 publier, et grimper au classement
 </span>
 </h1>
 <p className="max-w-2xl text-base sm:text-lg text-gray-600 mt-4 leading-relaxed">
 SPORT combine fil social, spots geolocalises, suivi de performance et leaderboards competitifs par ville et par spot.
 </p>
 <div className="flex flex-col sm:flex-row gap-3 mt-7">
 <Link
 href="/register"
 className="px-7 py-3.5 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-full transition shadow-[0_10px_20px_rgba(2,132,199,0.35)] text-center"
 >
 Creer mon compte
 </Link>
 <Link
 href="/login"
 className="px-7 py-3.5 border border-gray-300 hover:bg-white text-gray-800 font-bold rounded-full transition text-center"
 >
 J'ai deja un compte
 </Link>
 <Link
 href="/dashboard/social"
 className="px-7 py-3.5 border border-sky-300 hover:bg-sky-50 text-sky-800 font-bold rounded-full transition text-center"
 >
 Ouvrir le hub social
 </Link>
 </div>
 </section>

 <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 mb-6 sm:mb-8">
 {[
 { title: "Reseau social", desc: "Publiez vos performances, videos et records avec likes, commentaires et defis.", note: "A" },
 { title: "Carte des spots", desc: "Reperez bars, parcs et salles. Classements par spot pour une vraie scene locale.", note: "B" },
 { title: "Suivi & classements", desc: "Trackez vos perfs, detectez vos PR et montez dans les ligues Bronze a Legende.", note: "C + D" },
 ].map((f) => (
 <article key={f.title} className="ios-card p-5 sm:p-6">
 <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">{f.note}</p>
 <h2 className="font-bold text-gray-900 mt-2 text-lg">{f.title}</h2>
 <p className="text-sm text-gray-600 mt-2 leading-relaxed">{f.desc}</p>
 </article>
 ))}
 </section>

 <section className="ios-card p-5 sm:p-6">
 <h2 className="text-lg sm:text-xl font-bold text-gray-900">Fonctionnalites deja integrees</h2>
 <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-700">
 <li className="rounded-xl border border-gray-200 bg-white px-4 py-3">Actualites, messages et amis relies dans une meme rubrique sociale.</li>
 <li className="rounded-xl border border-gray-200 bg-white px-4 py-3">Performances, preuves video 480p, progression et validation communautaire.</li>
 <li className="rounded-xl border border-gray-200 bg-white px-4 py-3">Ligues Elo, equipes, classements par exercice et competitions locales.</li>
 <li className="rounded-xl border border-gray-200 bg-white px-4 py-3">Profils publics avec badge verifie, badges de progression et suivi hebdomadaire.</li>
 </ul>
 </section>

 <section className="ios-card p-5 sm:p-6 mt-6">
 <h2 className="text-lg sm:text-xl font-bold text-gray-900">Ligues de niveau</h2>
 <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm font-semibold">
 <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 text-center">Bronze</div>
 <div className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-slate-700 text-center">Argent</div>
 <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-3 py-2 text-yellow-800 text-center">Or</div>
 <div className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-cyan-800 text-center">Diamant</div>
 <div className="rounded-xl border border-purple-200 bg-purple-50 px-3 py-2 text-purple-800 text-center">Legende</div>
 </div>
 </section>
 </main>

 <footer className="text-center py-6 text-gray-500 text-sm border-t border-gray-200/80">
 2026 SPORT - Tous droits reserves
 </footer>
 </div>
 );
}

import Link from "next/link";

export default function Home() {
 return (
 <div className="ios-screen min-h-screen text-gray-900 flex flex-col">
 {/* NAV */}
 <nav className="sticky top-0 z-20 ios-nav-glass flex justify-between items-center px-4 sm:px-8 py-4">
 <span className="text-2xl font-black tracking-tight text-gray-900">SPORT</span>
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
 <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.16em] text-sky-700">Application sport</p>
 <h1 className="mt-3 text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[0.95]">
 Un espace clair pour
 <span className="block text-transparent bg-clip-text bg-gradient-to-r from-sky-500 to-teal-500">
 progresser chaque semaine
 </span>
 </h1>
 <p className="max-w-2xl text-base sm:text-lg text-gray-600 mt-4 leading-relaxed">
 SPORT regroupe vos seances, vos performances et votre reseau dans une interface simple a prendre en main sur mobile.
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
 </div>
 </section>

 <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 mb-6 sm:mb-8">
 {[
 { title: "1. Organiser", desc: "Preparez vos seances sans vous perdre dans des menus complexes.", note: "Entrainement" },
 { title: "2. Suivre", desc: "Consultez vos statistiques avec une lecture rapide des progres.", note: "Analyse" },
 { title: "3. Echanger", desc: "Restez connecte a votre reseau et a vos objectifs communs.", note: "Reseau" },
 ].map((f) => (
 <article key={f.title} className="ios-card p-5 sm:p-6">
 <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">{f.note}</p>
 <h2 className="font-bold text-gray-900 mt-2 text-lg">{f.title}</h2>
 <p className="text-sm text-gray-600 mt-2 leading-relaxed">{f.desc}</p>
 </article>
 ))}
 </section>

 <section className="ios-card p-5 sm:p-6">
 <h2 className="text-lg sm:text-xl font-bold text-gray-900">Pourquoi l'interface est plus simple</h2>
 <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-700">
 <li className="rounded-xl border border-gray-200 bg-white px-4 py-3">Navigation principale raccourcie avec un accueil central.</li>
 <li className="rounded-xl border border-gray-200 bg-white px-4 py-3">Actions importantes visibles en premier, sans surcharge.</li>
 <li className="rounded-xl border border-gray-200 bg-white px-4 py-3">Taille des boutons optimisee pour le mobile.</li>
 <li className="rounded-xl border border-gray-200 bg-white px-4 py-3">Lecture rapide grace a des sections plus nettes.</li>
 </ul>
 </section>
 </main>

 <footer className="text-center py-6 text-gray-500 text-sm border-t border-gray-200/80">
 2026 SPORT - Tous droits reserves
 </footer>
 </div>
 );
}

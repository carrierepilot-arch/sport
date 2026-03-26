import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* NAV */}
      <nav className="flex justify-between items-center px-8 py-5">
        <span className="text-2xl font-black tracking-tight text-white">SPORT</span>
        <div className="flex gap-3">
          <Link href="/login" className="px-5 py-2 text-sm font-semibold text-white border border-white/30 rounded-full hover:bg-white/10 transition">
            Se connecter
          </Link>
          <Link href="/register" className="px-5 py-2 text-sm font-semibold bg-emerald-500 rounded-full hover:bg-emerald-400 transition">
            S&apos;inscrire
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 pb-20">
        <span className="mb-6 inline-block bg-emerald-500/20 text-emerald-400 text-sm font-semibold px-4 py-1.5 rounded-full border border-emerald-500/30">
          Votre coach sportif personnel
        </span>

        <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-6 leading-none">
          Depassez{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
            vos limites
          </span>
        </h1>

        <p className="max-w-xl text-lg text-gray-400 mb-10 leading-relaxed">
          Suivez vos entrainements, analysez vos performances et atteignez vos objectifs sportifs. Tout en un seul endroit.
        </p>

        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href="/register"
            className="px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-lg rounded-full transition shadow-lg shadow-emerald-500/30"
          >
            Commencer gratuitement
          </Link>
          <Link
            href="/login"
            className="px-8 py-4 border border-white/20 hover:bg-white/10 text-white font-bold text-lg rounded-full transition"
          >
            Se connecter
          </Link>
        </div>

        <div className="mt-24 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl w-full">
          {[
            { title: "Profil", desc: "Gerez votre profil et vos objectifs personnels" },
            { title: "Entrainement", desc: "Creez et suivez vos seances d'entrainement" },
            { title: "Analyse", desc: "Visualisez vos progres et statistiques" },
          ].map((f) => (
            <div key={f.title} className="bg-white/5 border border-white/10 rounded-2xl p-6 text-left hover:bg-white/10 transition">
              <h3 className="font-bold text-white mb-1">{f.title}</h3>
              <p className="text-sm text-gray-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="text-center py-6 text-gray-600 text-sm border-t border-white/5">
        2026 SPORT - Tous droits reserves
      </footer>
    </div>
  );
}

'use client';

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 to-gray-800 px-4">
      <div className="text-center space-y-6">
        <div className="text-6xl">📡</div>
        <h1 className="text-3xl font-black text-white">Pas de connexion</h1>
        <p className="text-gray-300 text-lg max-w-sm">
          Vous êtes hors ligne. Vérifiez votre connexion internet et réessayez.
        </p>
        
        <div className="bg-gray-800 rounded-2xl p-6 mt-8 text-left space-y-4 max-w-sm">
          <h2 className="font-bold text-white mb-4">Vous pouvez:</h2>
          <ul className="space-y-3 text-gray-300">
            <li className="flex items-start gap-3">
              <span className="text-lg">✓</span>
              <span>Consulter vos séances sauvegardées localement</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-lg">✓</span>
              <span>Jouer aux mini-jeux en mode hors ligne</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-lg">✓</span>
              <span>Consulter vos fichiers en cache</span>
            </li>
          </ul>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="mt-8 px-8 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl transition"
        >
          Réessayer la connexion
        </button>
      </div>
    </div>
  );
}

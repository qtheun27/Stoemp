// Configuration propre au robot : évite que Vitest charge celle de l'appli (dossier parent).
export default { test: { include: ["src/**/*.test.ts"] } };

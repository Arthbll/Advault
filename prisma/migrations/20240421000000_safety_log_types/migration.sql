-- ============================================================
-- Migration: safety_log_types
-- Ajoute deux nouveaux types d'événements dans l'enum LogType :
--   KILL_BLOCKED_NO_DATA — Kill-switch bloqué (période de grâce 48h, aucun postback)
--   SAFETY_DOWNGRADE     — Engine basculé en mode recommendation (aucun postback après 48h)
--
-- Ces events permettent de tracer le comportement de la défense en profondeur
-- contre les kills à tort quand le tracker postback n'est pas encore branché.
-- ============================================================

-- PostgreSQL : ajout de valeurs à un type enum existant.
-- IF NOT EXISTS pour rendre la migration ré-exécutable sans erreur.
ALTER TYPE "LogType" ADD VALUE IF NOT EXISTS 'KILL_BLOCKED_NO_DATA';
ALTER TYPE "LogType" ADD VALUE IF NOT EXISTS 'SAFETY_DOWNGRADE';

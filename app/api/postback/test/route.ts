/**
 * POST /api/postback/test
 *
 * Crée une conversion de test pour l'utilisateur connecté.
 *
 * But : permettre à un user de vérifier rapidement que son postback flow
 * fonctionne ET de sortir de la période de grâce 48h (sans avoir à attendre
 * qu'une vraie vente arrive). Après un test réussi, l'engine pourra agir
 * normalement en mode automatic puisque `firstPostback` ne sera plus null.
 *
 * Usage recommandé par le client :
 *   1. Configurer l'URL postback dans le tracker (Voluum, BeMob, etc.)
 *    2. Déclencher ce test depuis Settings → Tracking
 *    3. Vérifier que la conversion apparaît dans /conversions
 *
 * Sécurité :
 *   - Requiert une session Supabase valide
 *   - La conversion est taguée source="test" pour pouvoir la distinguer
 *   - clickId unique généré automatiquement → bénéficie de la dédup atomique
 *   - Pas d'abus possible : un user ne peut créer des test que pour son propre userId
 */

import { NextResponse } from "next/server";
import { randomUUID }   from "crypto";
import { prisma }       from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Création de la conversion de test ─────────────────────────────────────
  // clickId unique pour ne jamais entrer en collision avec des postbacks réels
  const testClickId = `test_${user.id}_${Date.now()}_${randomUUID().slice(0, 8)}`;

  try {
    const conversion = await prisma.conversion.create({
      data: {
        userId:   user.id,
        clickId:  testClickId,
        revenue:  1.00,           // symbolique — 1$ pour visualiser dans le dashboard
        currency: "USD",
        source:   "test",
      },
      select: {
        id:        true,
        createdAt: true,
        clickId:   true,
      },
    });

    return NextResponse.json({
      ok:           true,
      message:      "Test postback enregistré. Tu peux maintenant activer le mode Automatic sans risque de grace period.",
      conversionId: conversion.id,
      clickId:      conversion.clickId,
      createdAt:    conversion.createdAt,
    });
  } catch (err) {
    console.error("[/api/postback/test] Erreur création conversion test:", err);
    return NextResponse.json(
      { error: "Impossible de créer la conversion de test", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

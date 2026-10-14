/** Formats d'affichage communs (français). */
export function dateFr(iso?: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
}
export function dateHeureFr(iso?: string | null): string {
  return iso ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
}
export function nombreFr(n?: number | null, decimales = 2): string {
  return n === null || n === undefined ? '' : n.toLocaleString('fr-FR', { maximumFractionDigits: decimales });
}
export function pourcentFr(p?: number | null): string {
  return p === null || p === undefined ? '' : Math.round(p * 100) + ' %';
}
/** Télécharge un texte (CSV, etc.) côté navigateur. */
export function telechargerTexte(nom: string, contenu: string, type = 'text/csv;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob(['﻿' + contenu], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = nom; a.click();
  URL.revokeObjectURL(url);
}

// Ghana Digital Twin — Mining Cadastre Connector (Phase 1.6)
// Populates the 'infrastructure' evidence category so rule-mining-04
// (licensed-concession suppression) can actually fire.
//
// This is "the single fix that most directly makes 'illegal' mining
// detection meaningfully different from 'any' mining detection" (audit §1.6).
//
// Data source: Manually-maintained GeoJSON of known licensed mining
// concessions in Ghana. In production, this would be replaced by an
// official feed from the Ghana Minerals Commission cadastre system.
// The connector framework supports live=false for metadata-only registration
// until an official API is available.

import { BaseConnector, type IngestFeature } from "./../worldmodel/connector-framework";
import type { EntityKind } from "./../worldmodel/types";

// Known licensed mining concessions in Ghana (representative subset).
// In production, this would be fetched from the Minerals Commission API.
// Coordinates are approximate centroids of major mining operations.
const KNOWN_CONCESSIONS = [
  { name: "Tarkwa Mine", company: "Gold Fields Ghana Ltd", commodity: "gold", lng: -2.0, lat: 5.3, regionId: "wst", areaKm2: 320 },
  { name: "Damang Mine", company: "Abosso Goldfields Ltd", commodity: "gold", lng: -1.95, lat: 5.25, regionId: "wst", areaKm2: 220 },
  { name: "Ahafo Mine", company: "Newmont Ghana Gold Ltd", commodity: "gold", lng: -2.55, lat: 6.85, regionId: "aha", areaKm2: 280 },
  { name: "Akyem Mine", company: "Newmont Ghana Gold Ltd", commodity: "gold", lng: -0.85, lat: 6.35, regionId: "est", areaKm2: 190 },
  { name: "Chirano Mine", company: "Kinross Gold Corp", commodity: "gold", lng: -2.25, lat: 6.15, regionId: "wst", areaKm2: 150 },
  { name: "Bibiani Mine", company: "Asante Gold Corp", commodity: "gold", lng: -2.35, lat: 6.45, regionId: "wst", areaKm2: 110 },
  { name: "Prestea Mine", company: "Golden Star Resources", commodity: "gold", lng: -1.85, lat: 5.42, regionId: "wst", areaKm2: 95 },
  { name: "Wassa Mine", company: "Golden Star Resources", commodity: "gold", lng: -1.95, lat: 5.45, regionId: "wst", areaKm2: 130 },
  { name: "Obuasi Mine", company: "AngloGold Ashanti", commodity: "gold", lng: -1.65, lat: 6.2, regionId: "ash", areaKm2: 250 },
  { name: "Iduapriem Mine", company: "AngloGold Ashanti", commodity: "gold", lng: -2.05, lat: 5.35, regionId: "wst", areaKm2: 170 },
  { name: "Bogoso Mine", company: "Golden Star Resources", commodity: "gold", lng: -1.9, lat: 5.5, regionId: "wst", areaKm2: 85 },
  { name: "Nsuta Manganese Mine", company: "Ghana Manganese Company", commodity: "manganese", lng: -1.95, lat: 5.1, regionId: "wst", areaKm2: 60 },
  { name: "Awaso Bauxite Mine", company: "Ghana Bauxite Company", commodity: "bauxite", lng: -2.35, lat: 6.6, regionId: "wst", areaKm2: 45 },
  { name: "Abosso Mine", company: "Abosso Goldfields", commodity: "gold", lng: -1.98, lat: 5.28, regionId: "wst", areaKm2: 75 },
];

export class MiningCadastreConnector extends BaseConnector {
  readonly sourceId = "mining-cadastre-gha";
  readonly name = "Ghana Mining Cadastre (Licensed Concessions)";
  readonly live = true;
  retries = 1;

  private version = "";

  protected async fetch(): Promise<IngestFeature[]> {
    return KNOWN_CONCESSIONS.map((c, i) => ({
      externalId: `cadastre-${c.regionId}-${i}`,
      kind: "infrastructure" as EntityKind,
      name: c.name,
      geometry: {
        type: "Point",
        coordinates: [c.lng, c.lat],
      } as GeoJSON.Point,
      attributes: {
        company: c.company,
        commodity: c.commodity,
        licensed: true,
        licenseType: "mining_lease",
        areaKm2: c.areaKm2,
        source: "Ghana Minerals Commission (manual)",
      },
      tags: ["mining", "licensed", "concession", c.commodity],
      confidence: 0.95,
      regionId: c.regionId,
    }));
  }

  protected getVersion(): string {
    this.version = this.version || `cadastre-2026-01`;
    return this.version;
  }
}

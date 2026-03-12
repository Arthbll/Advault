/**
 * TrafficStars API adapter
 * Docs: https://api.trafficstars.com/docs
 * Auth: Bearer token
 */

export interface TrafficStarsCampaign {
  id:     string;
  name:   string;
  status: "active" | "paused" | "stopped";
}

export interface TrafficStarsStats {
  campaignId:  string;
  impressions: number;
  clicks:      number;
  conversions: number;
  spent:       number;
  dateFrom:    string;
  dateTo:      string;
}

const BASE = "https://api.trafficstars.com/v1";

export class TrafficStarsAdapter {
  private token: string;

  constructor(apiKey: string) {
    this.token = apiKey;
  }

  private async fetch<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`TrafficStars ${path} → ${res.status} ${text}`);
    }

    return res.json() as Promise<T>;
  }

  async getCampaigns(): Promise<TrafficStarsCampaign[]> {
    const data = await this.fetch<{ data: TrafficStarsCampaign[] }>("/advertiser/campaigns");
    return data.data ?? [];
  }

  async pauseCampaign(campaignId: string): Promise<void> {
    await this.fetch(`/advertiser/campaigns/${campaignId}/pause`, { method: "POST" });
  }

  async resumeCampaign(campaignId: string): Promise<void> {
    await this.fetch(`/advertiser/campaigns/${campaignId}/resume`, { method: "POST" });
  }

  async getStats(dateFrom: string, dateTo: string): Promise<TrafficStarsStats[]> {
    const body = {
      filters: { date_from: dateFrom, date_to: dateTo },
      group_by: ["campaign"],
      metrics: ["impressions", "clicks", "conversions", "spent"],
    };

    const data = await this.fetch<{ data: RawRow[] }>(
      "/advertiser/statistics", {
        method: "POST",
        body: JSON.stringify(body),
      }
    );

    return (data.data ?? []).map(row => ({
      campaignId:  String(row.campaign_id),
      impressions: Number(row.impressions)  ?? 0,
      clicks:      Number(row.clicks)       ?? 0,
      conversions: Number(row.conversions)  ?? 0,
      spent:       parseFloat(row.spent)    ?? 0,
      dateFrom,
      dateTo,
    }));
  }
}

interface RawRow {
  campaign_id:  string | number;
  impressions:  string | number;
  clicks:       string | number;
  conversions:  string | number;
  spent:        string;
}

"use client";

import dynamic from "next/dynamic";

// ApexCharts utilise des APIs browser — chargement client uniquement
const ApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

export interface ChartPoint {
  date:    string;
  profit:  number;
  spend:   number;
  revenue: number;
}

interface Props {
  data:      ChartPoint[];
  profitPos: boolean;
  height?:   number;
}

export default function ProfitChart({ data, profitPos, height = 140 }: Props) {
  const profitColor  = profitPos ? "#4ade80" : "#f87171";
  const revenueColor = "#8b5cf6";

  const options: ApexCharts.ApexOptions = {
    chart: {
      type:       "area",
      background: "transparent",
      toolbar:    { show: false },
      animations: {
        enabled:          true,
        speed:            500,
        animateGradually: { enabled: true, delay: 60 },
      },
      zoom:       { enabled: false },
      fontFamily: "inherit",
    },

    stroke: {
      curve: "smooth",
      width: [3, 3],
    },

    fill: {
      type: "gradient",
      gradient: {
        type:           "vertical",
        shadeIntensity: 0,
        opacityFrom:    0.28,
        opacityTo:      0.01,
        stops:          [0, 90],
      },
    },

    colors: [revenueColor, profitColor],

    dataLabels: { enabled: false },

    xaxis: {
      categories: data.map(d => d.date),
      tickAmount: data.length > 20 ? 5 : undefined,
      labels: {
        style: {
          colors:     "rgba(255,255,255,0.35)",
          fontSize:   "10px",
          fontFamily: "inherit",
        },
        rotate:                  0,
        hideOverlappingLabels:   true,
      },
      axisBorder: { show: false },
      axisTicks:  { show: false },
      tooltip:    { enabled: false },
    },

    yaxis: { show: false },

    grid: {
      show:    false,
      padding: { left: -10, right: 0, top: 0, bottom: -8 },
    },

    tooltip: {
      theme: "dark",
      style: { fontSize: "11px", fontFamily: "inherit" },
      x:     { show: true },
      y: {
        formatter: (val: number) =>
          `€${Math.round(val).toLocaleString("en-GB")}`,
      },
      marker: { show: true },
    },

    legend: { show: false },

    markers: {
      size:        0,
      hover:       { size: 4, sizeOffset: 0 },
      strokeWidth: 0,
    },
  };

  const series = [
    { name: "Revenue", data: data.map(d => d.revenue) },
    { name: "Profit",  data: data.map(d => d.profit)  },
  ];

  return (
    <ApexChart
      type="area"
      options={options}
      series={series}
      height={height}
      width="100%"
    />
  );
}

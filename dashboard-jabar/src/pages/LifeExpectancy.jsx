import React, { useEffect, useState } from "react";
import { ResponsiveBar } from "@nivo/bar";
import Papa from "papaparse";

export default function LifeExpectancy() {
  const [data, setData] = useState([]);
  const [yearOptions, setYearOptions] = useState([]);
  const [year, setYear] = useState("");
  const [regionType, setRegionType] = useState("Semua");

  useEffect(() => {
    fetch(
      "/bps-od_17105_angka_harapan_hidup_hasil_sp2010__kabupatenkota_data.csv"
    )
      .then((r) => r.text())
      .then((csv) => {
        Papa.parse(csv, {
          header: true,
          skipEmptyLines: true,
          complete: ({ data }) => {
            const formatted = data
              .map((r) => ({
                tahun: r.tahun?.trim(),
                daerah: r.nama_kabupaten_kota?.trim(),
                AHH: parseFloat(r.angka_harapan_hidup?.trim()),
                tipe: r.nama_kabupaten_kota?.toLowerCase().includes("kota")
                  ? "Kota"
                  : "Kabupaten",
              }))
              .filter((r) => r.tahun && r.daerah && !isNaN(r.AHH));

            const yrs = [...new Set(formatted.map((r) => r.tahun))].sort();
            setYearOptions(yrs);
            setYear(yrs[0]);
            setData(formatted);
          },
        });
      });
  }, []);

  const filteredAll = data.filter((r) => r.tahun === year);
  const avgAHH =
    filteredAll.reduce((a, c) => a + c.AHH, 0) / filteredAll.length || 0;

  const display = filteredAll
    .filter((r) => regionType === "Semua" || r.tipe === regionType)
    .sort((a, b) => b.AHH - a.AHH)
    .map((r) => ({ ...r, avg: avgAHH }));

  return (
    <section className="pt-6 pb-8 px-4">
      <div className="container mx-auto bg-white p-6 rounded-lg shadow-lg">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-semibold">
              Perbandingan AHH Jawa Barat – {year}
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className={`px-4 py-2 rounded-md transition-colors duration-200 ${
                  regionType === "Semua"
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
                onClick={() => setRegionType("Semua")}
              >
                Semua Tipe
              </button>
              <button
                className={`px-4 py-2 rounded-md transition-colors duration-200 ${
                  regionType === "Kota"
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
                onClick={() => setRegionType("Kota")}
              >
                Kota
              </button>
              <button
                className={`px-4 py-2 rounded-md transition-colors duration-200 ${
                  regionType === "Kabupaten"
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
                onClick={() => setRegionType("Kabupaten")}
              >
                Kabupaten
              </button>
            </div>
          </div>
          <select
            className="border px-3 py-1 rounded"
            value={year}
            onChange={(e) => setYear(e.target.value)}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <div style={{ height: 500 }}>
          <ResponsiveBar
            data={display}
            keys={["AHH"]}
            indexBy="daerah"
            layout="vertical"
            margin={{ top: 50, right: 130, bottom: 100, left: 200 }}
            padding={0.3}
            valueScale={{ type: "linear" }}
            indexScale={{ type: "band", round: true }}
            colors={({ data }) =>
              data.AHH >= data.avg ? "#4ade80" : "#f87171"
            }
            axisLeft={{ tickSize: 5, tickPadding: 5, tickRotation: -45 }}
            axisBottom={null}
            enableGridY={false}
            legends={[
              {
                dataFrom: "keys",
                anchor: "bottom-right",
                direction: "column",
                translateX: 120,
                itemWidth: 100,
                itemHeight: 20,
                symbolSize: 12,
              },
            ]}
            tooltip={({ id, value, indexValue, data }) => (
              <div
                style={{
                  padding: 8,
                  background: "#fff",
                  border: "1px solid #ccc",
                }}
              >
                <strong>{indexValue}</strong>
                <br />
                AHH: {value} tahun
                <br />
                {value >= data.avg ? "≥ rata-rata" : "< rata-rata"} (
                {data.avg.toFixed(2)})
              </div>
            )}
            markers={[
              {
                axis: "y",
                value: avgAHH,
                lineStyle: {
                  stroke: "red",
                  strokeWidth: 2,
                  strokeDasharray: "4 4",
                },
                legend: "Rata-rata provinsi",
                legendPosition: "top-right",
              },
            ]}
          />
        </div>
      </div>
    </section>
  );
}

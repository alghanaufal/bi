import React, { useEffect, useState } from "react";
import { ResponsivePie } from "@nivo/pie";
import Papa from "papaparse";

export default function HealthFacilityPieChart() {
  const [rawData, setRawData] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState("SEMUA");
  const [regions, setRegions] = useState([]);
  const [isLoading, setIsLoading] = useState(true); // State untuk loading
  const [error, setError] = useState(null); // State untuk error

  useEffect(() => {
    setIsLoading(true); // Mulai loading
    setError(null); // Reset error
    fetch(
      "/dinkes-od_15936_jumlah_fasilitas_kesehatan_berdasarkan_jenis_v1_data.csv"
    ) 
      .then((r) => {
        if (!r.ok) {
          throw new Error(`HTTP error! status: ${r.status}`);
        }
        return r.text();
      })
      .then((csv) => {
        Papa.parse(csv, {
          header: true,
          skipEmptyLines: true,
          complete: ({ data, errors }) => {
            if (errors.length > 0) {
              console.error("Error parsing CSV:", errors);
              setError("Terjadi kesalahan saat mengurai data CSV.");
              setIsLoading(false);
              return;
            }

            const cleaned = data
              .map((row) => ({
                tahun: row.tahun?.trim(),
                kota: row.nama_kabupaten_kota?.trim(),
                jenis: row.jenis_faskes?.trim(),
                jumlah: parseInt(row.jumlah_faskes),
              }))
              .filter((r) => r.kota && r.jenis && !isNaN(r.jumlah)); // Pastikan jumlah adalah angka valid

            const uniqueRegions = [
              ...new Set(cleaned.map((r) => r.kota)),
            ].sort();
            setRawData(cleaned);
            setRegions(["SEMUA", ...uniqueRegions]);
            setSelectedRegion("SEMUA");
            setIsLoading(false); // Selesai loading
          },
          error: (err) => {
            console.error("Error PapaParse:", err);
            setError("Terjadi kesalahan saat memproses data CSV.");
            setIsLoading(false);
          }
        });
      })
      .catch((err) => {
        console.error("Fetch error:", err);
        setError(`Gagal memuat data: ${err.message}. Pastikan file CSV tersedia di path yang benar.`);
        setIsLoading(false); // Selesai loading dengan error
      });
  }, []);

  const filtered = rawData.filter((d) =>
    selectedRegion === "SEMUA" ? true : d.kota === selectedRegion
  );

  const grouped = Object.values(
    filtered.reduce((acc, curr) => {
      const key = curr.jenis;
      if (!acc[key]) {
        acc[key] = {
          id: key,
          label: key,
          value: 0,
        };
      }
      acc[key].value += curr.jumlah;
      return acc;
    }, {})
  );

  if (isLoading) {
    return (
      <section className="pt-6 pb-8 px-4 flex items-center justify-center h-screen">
        <div className="text-xl font-semibold text-gray-700">Memuat data...</div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="pt-6 pb-8 px-4 flex items-center justify-center h-screen">
        <div className="text-red-600 text-lg font-semibold p-4 border border-red-300 bg-red-50 rounded-lg shadow-md">
          <p>Error: {error}</p>
          <p>Mohon periksa konsol browser untuk detail lebih lanjut.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="pt-6 pb-8 px-4 font-inter"> {/* Added font-inter */}
      <div className="container mx-auto bg-white p-6 rounded-lg shadow-lg">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4"> {/* Responsive layout for header */}
          <div>
            <h2 className="text-2xl font-semibold text-gray-800">
              Komposisi Fasilitas Kesehatan –{" "}
              {selectedRegion === "SEMUA" ? "JAWA BARAT" : selectedRegion}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Menampilkan proporsi jenis fasilitas kesehatan berdasarkan{" "}
              <span className="font-medium">
                {selectedRegion === "SEMUA" ? "seluruh provinsi" : selectedRegion}
              </span>
              .
            </p>
          </div>
          <select
            className="border border-gray-300 px-4 py-2 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-gray-700 hover:border-gray-400 transition duration-150 ease-in-out"
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
          >
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div style={{ height: 500 }} className="w-full"> {/* Make height responsive within container */}
          {grouped.length > 0 ? (
            <ResponsivePie
              data={grouped}
              margin={{ top: 40, right: 120, bottom: 80, left: 80 }}
              innerRadius={0.5}
              padAngle={0.7}
              cornerRadius={3}
              activeOuterRadiusOffset={8}
              colors={{ scheme: "nivo" }}
              borderWidth={1}
              borderColor={{ from: "color", modifiers: [["darker", 0.2]] }}
              arcLinkLabelsSkipAngle={10}
              arcLinkLabelsTextColor="#333"
              arcLinkLabelsThickness={2}
              arcLinkLabelsColor={{ from: "color" }}
              arcLabelsSkipAngle={10}
              arcLabelsTextColor={{ from: "color", modifiers: [["darker", 2]] }}
              tooltip={({ datum }) => (
                <div
                  style={{
                    background: "white",
                    padding: 12,
                    border: "1px solid #ccc",
                    borderRadius: 4,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)", // Add subtle shadow for tooltip
                  }}
                  className="font-inter text-sm" // Apply font and size to tooltip
                >
                  <strong>{datum.label}</strong>: {datum.value} unit
                </div>
              )}
              legends={[
                {
                  anchor: "bottom",
                  direction: "row",
                  translateY: 56,
                  itemWidth: 100,
                  itemHeight: 18,
                  itemTextColor: "#999",
                  symbolSize: 18,
                  symbolShape: "circle",
                  effects: [
                    {
                      on: "hover",
                      style: {
                        itemTextColor: "#000",
                      },
                    },
                  ],
                },
              ]}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              Tidak ada data fasilitas kesehatan yang tersedia untuk wilayah ini.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

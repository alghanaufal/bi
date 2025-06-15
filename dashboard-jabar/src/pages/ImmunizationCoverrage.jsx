import React, { useEffect, useState, useMemo } from "react";
import { ResponsiveBar } from "@nivo/bar";
import Papa from "papaparse";

export default function ImmunizationCoverageBarChart() {
  const [rawData, setRawData] = useState([]);
  const [yearOptions, setYearOptions] = useState([]);
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedRegionType, setSelectedRegionType] = useState("Semua"); // Filter for region type
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const CSV_URL =
    "/dinkes-od_17464_jml_bayi_mendapat_imunisasi_dasar_lengkap__jk_v1_data.csv";

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    fetch(CSV_URL)
      .then((r) => {
        if (!r.ok) {
          throw new Error(`HTTP error! Status: ${r.status}`);
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

            const formatted = data
              .map((row) => ({
                tahun: row.tahun?.trim(),
                daerah: row.nama_kabupaten_kota?.trim(),
                jumlah_bayi: parseInt(row.jumlah_bayi), // Convert to integer
                jenis_kelamin: row.jenis_kelamin?.trim(), // Keep jenis_kelamin for aggregation
                // Deteksi tipe daerah: "Kota" jika nama mengandung "kota", selain itu "Kabupaten"
                tipe: row.nama_kabupaten_kota?.toLowerCase().includes("kota")
                  ? "Kota"
                  : "Kabupaten",
                provinsi: row.nama_provinsi?.trim(),
              }))
              .filter(
                (r) =>
                  r.provinsi === "JAWA BARAT" && // Filter hanya untuk Jawa Barat
                  r.tahun &&
                  r.daerah &&
                  !isNaN(r.jumlah_bayi) &&
                  r.jumlah_bayi >= 0 // Pastikan jumlah bayi valid
              );

            const uniqueYears = [
              ...new Set(formatted.map((r) => r.tahun)),
            ].sort();
            setYearOptions(uniqueYears);
            if (uniqueYears.length > 0) {
              setSelectedYear(uniqueYears[uniqueYears.length - 1]); // Default to latest year
            }
            setRawData(formatted); // Set rawData, not directly display data
            setIsLoading(false);
          },
          error: (err) => {
            console.error("Error PapaParse:", err);
            setError("Terjadi kesalahan saat memproses data CSV.");
            setIsLoading(false);
          },
        });
      })
      .catch((err) => {
        console.error("Fetch error:", err);
        setError(
          `Gagal memuat data: ${err.message}. Pastikan file CSV tersedia di path yang benar.`
        );
        setIsLoading(false);
      });
  }, []);

  // Filter and process data for display based on year and region type
  const displayData = useMemo(() => {
    if (!rawData.length || !selectedYear) {
      return [];
    }

    const filteredByYear = rawData.filter((r) => r.tahun === selectedYear);

    // Aggregate jumlah_bayi by 'daerah' for the selected year (summing up male/female)
    const aggregatedByDaerah = filteredByYear.reduce((acc, curr) => {
      const key = curr.daerah;
      if (!acc[key]) {
        acc[key] = {
          daerah: curr.daerah,
          total_imunisasi: 0,
          tipe: curr.tipe, // Preserve region type
        };
      }
      acc[key].total_imunisasi += curr.jumlah_bayi;
      return acc;
    }, {});

    // Convert aggregated object back to an array
    let processedForDisplay = Object.values(aggregatedByDaerah);

    // Further filter by region type (Kota/Kabupaten)
    if (selectedRegionType !== "Semua") {
      processedForDisplay = processedForDisplay.filter(
        (r) => r.tipe === selectedRegionType
      );
    }

    // Sort data from highest imunisasi count to lowest
    processedForDisplay.sort((a, b) => b.total_imunisasi - a.total_imunisasi);

    return processedForDisplay;
  }, [rawData, selectedYear, selectedRegionType]);

  // Loading, Error, and No Data states
  if (isLoading) {
    return (
      <section className="pt-6 pb-8 px-4 flex items-center justify-center h-screen">
        <div className="text-xl font-semibold text-gray-700">
          Memuat data...
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="pt-6 pb-8 px-4 flex items-center justify-center h-screen">
        <div className="text-red-600 text-lg font-semibold p-4 border border-red-300 bg-red-50 rounded-lg shadow-md text-center">
          <p className="mb-2">Error: {error}</p>
          <p>Mohon periksa konsol browser untuk detail lebih lanjut.</p>
          <p className="text-sm mt-2">
            Pastikan file CSV tersedia di root folder aplikasi.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="pt-6 pb-8 px-4 font-inter bg-gray-50 min-h-screen">
      <div className="container mx-auto bg-white p-6 rounded-lg shadow-xl border border-gray-200">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h2 className="text-3xl font-bold text-gray-800 mb-1">
              Distribusi Jumlah Bayi Imunisasi Dasar Lengkap
            </h2>
            <p className="text-md text-gray-600">
              Menganalisis distribusi jumlah bayi yang mendapatkan imunisasi
              dasar lengkap per kabupaten/kota Jawa Barat.
            </p>
            {/* Filter buttons for region type */}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className={`px-4 py-2 rounded-md transition-colors duration-200 ${
                  selectedRegionType === "Semua"
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
                onClick={() => setSelectedRegionType("Semua")}
              >
                Semua Tipe
              </button>
              <button
                className={`px-4 py-2 rounded-md transition-colors duration-200 ${
                  selectedRegionType === "Kota"
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
                onClick={() => setSelectedRegionType("Kota")}
              >
                Kota
              </button>
              <button
                className={`px-4 py-2 rounded-md transition-colors duration-200 ${
                  selectedRegionType === "Kabupaten"
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
                onClick={() => setSelectedRegionType("Kabupaten")}
              >
                Kabupaten
              </button>
            </div>
          </div>
          <select
            className="border border-gray-300 px-4 py-2 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-gray-700 hover:border-gray-400 transition duration-150 ease-in-out w-full sm:w-auto"
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
          >
            {yearOptions.length > 0 ? (
              yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))
            ) : (
              <option value="">Tidak ada tahun tersedia</option>
            )}
          </select>
        </div>

        <div style={{ height: 600 }}>
          {" "}
          {/* Increased height for better bar readability */}
          {displayData.length > 0 ? (
            <ResponsiveBar
              data={displayData}
              keys={["total_imunisasi"]} // Key for the value (jumlah_bayi)
              indexBy="daerah" // X-axis will be daerah (kabupaten/kota)
              layout="vertical" // Standard vertical bar chart
              margin={{ top: 20, right: 30, bottom: 120, left: 80 }} // Adjusted bottom margin for rotated labels
              padding={0.2}
              valueScale={{ type: "linear" }}
              indexScale={{ type: "band", round: true }}
              colors={{ scheme: "nivo" }} // Using a default Nivo color scheme
              borderColor={{ from: "color", modifiers: [["darker", 1.6]] }}
              axisTop={null}
              axisRight={null}
              axisBottom={{
                tickSize: 5,
                tickPadding: 5,
                tickRotation: -45, // Rotate labels for better readability
                legend: "Kabupaten/Kota",
                legendPosition: "middle",
                legendOffset: 100, // Adjust offset for rotated labels
                truncateTickAt: 0,
              }}
              axisLeft={{
                tickSize: 5,
                tickPadding: 5,
                tickRotation: 0,
                legend: "Jumlah Bayi Imunisasi (Orang)", // Y-axis label
                legendPosition: "middle",
                legendOffset: -60,
                truncateTickAt: 0,
              }}
              labelSkipWidth={12}
              labelSkipHeight={12}
              labelTextColor={{ from: "color", modifiers: [["darker", 1.6]] }}
              tooltip={({ id, value, indexValue, data }) => (
                <div
                  style={{
                    padding: 8,
                    background: "#fff",
                    border: "1px solid #ccc",
                  }}
                  className="font-inter text-sm"
                >
                  <strong>{indexValue}</strong> ({data.tipe})
                  <br />
                  Jumlah Imunisasi: <strong>{value} orang</strong>
                </div>
              )}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              Tidak ada data imunisasi bayi untuk ditampilkan di tahun{" "}
              {selectedYear}
              {selectedRegionType !== "Semua"
                ? ` untuk tipe daerah ${selectedRegionType}`
                : ""}
              .
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

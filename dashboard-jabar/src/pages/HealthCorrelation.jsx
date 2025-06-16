import React, { useEffect, useState, useMemo } from "react";
import { ResponsiveScatterPlot } from "@nivo/scatterplot";
import Papa from "papaparse";

export default function HealthCorrelationScatterPlot() {
  const [facilityData, setFacilityData] = useState([]);
  const [lifeExpectancyData, setLifeExpectancyData] = useState([]);
  const [processedData, setProcessedData] = useState([]);
  const [selectedYear, setSelectedYear] = useState(""); // State for selected year filter
  const [availableYears, setAvailableYears] = useState([]); // List of years available in combined data
  const [isLoading, setIsLoading] = useState(true); // Loading state
  const [error, setError] = useState(null); // Error state

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    // Define file paths for the two CSVs
    const facilityCsvPath = "/dinkes-od_15936_jumlah_fasilitas_kesehatan_berdasarkan_jenis_v1_data.csv";
    const lifeExpectancyCsvPath = "/bps-od_17105_angka_harapan_hidup_hasil_sp2010__kabupatenkota_data.csv";

    // Fetch both CSV files concurrently
    Promise.all([fetch(facilityCsvPath), fetch(lifeExpectancyCsvPath)])
      .then(async ([facilityRes, lifeExpectancyRes]) => {
        // Check if both responses are OK
        if (!facilityRes.ok) throw new Error(`HTTP error! Status: ${facilityRes.status} for ${facilityCsvPath}`);
        if (!lifeExpectancyRes.ok) throw new Error(`HTTP error! Status: ${lifeExpectancyRes.status} for ${lifeExpectancyCsvPath}`);

        const facilityText = await facilityRes.text();
        const lifeExpectancyText = await lifeExpectancyRes.text();

        // Parse facility data
        const parseFacility = new Promise((resolve, reject) => {
          Papa.parse(facilityText, {
            header: true,
            skipEmptyLines: true,
            complete: ({ data, errors }) => {
              if (errors.length > 0) {
                reject(new Error(`Error parsing facility CSV: ${JSON.stringify(errors)}`));
              }
              const cleaned = data.map((row) => ({
                kota: row.nama_kabupaten_kota?.trim(),
                jenis: row.jenis_faskes?.trim(),
                jumlah: parseInt(row.jumlah_faskes),
                tahun: row.tahun?.trim(),
                provinsi: row.nama_provinsi?.trim(),
              })).filter((r) => r.provinsi === "JAWA BARAT" && r.kota && !isNaN(r.jumlah) && r.tahun);
              resolve(cleaned);
            },
            error: (err) => reject(new Error(`PapaParse facility error: ${err.message}`)),
          });
        });

        // Parse life expectancy data
        const parseLifeExpectancy = new Promise((resolve, reject) => {
          Papa.parse(lifeExpectancyText, {
            header: true,
            skipEmptyLines: true,
            complete: ({ data, errors }) => {
              if (errors.length > 0) {
                reject(new Error(`Error parsing life expectancy CSV: ${JSON.stringify(errors)}`));
              }
              const cleaned = data.map((row) => ({
                kota: row.nama_kabupaten_kota?.trim(),
                angka_harapan_hidup: parseFloat(row.angka_harapan_hidup),
                tahun: row.tahun?.trim(),
                provinsi: row.nama_provinsi?.trim(),
              })).filter((r) => r.provinsi === "JAWA BARAT" && r.kota && !isNaN(r.angka_harapan_hidup) && r.tahun);
              resolve(cleaned);
            },
            error: (err) => reject(new Error(`PapaParse life expectancy error: ${err.message}`)),
          });
        });

        // Wait for both parsing operations to complete
        const [facilities, lifeExpectancies] = await Promise.all([
          parseFacility,
          parseLifeExpectancy,
        ]);

        setFacilityData(facilities);
        setLifeExpectancyData(lifeExpectancies);

        // --- Data Merging and Aggregation ---
        // Aggregate total facilities per kota and year
        const aggregatedFacilities = facilities.reduce((acc, curr) => {
          const key = `${curr.kota}-${curr.tahun}`;
          if (!acc[key]) {
            acc[key] = {
              kota: curr.kota,
              tahun: curr.tahun,
              total_faskes: 0,
            };
          }
          acc[key].total_faskes += curr.jumlah;
          return acc;
        }, {});

        const merged = [];
        const uniqueYears = new Set();

        // Merge aggregated facility data with life expectancy data
        Object.values(aggregatedFacilities).forEach((faskesEntry) => {
          const matchingLifeExpectancy = lifeExpectancies.find(
            (lifeEntry) =>
              lifeEntry.kota === faskesEntry.kota && lifeEntry.tahun === faskesEntry.tahun
          );

          if (matchingLifeExpectancy) {
            merged.push({
              kota: faskesEntry.kota,
              tahun: faskesEntry.tahun,
              total_faskes: faskesEntry.total_faskes,
              angka_harapan_hidup: matchingLifeExpectancy.angka_harapan_hidup,
            });
            uniqueYears.add(faskesEntry.tahun);
          }
        });

        const sortedYears = Array.from(uniqueYears).sort();
        setProcessedData(merged);
        setAvailableYears(sortedYears);

        // Set the latest year as default selected year
        if (sortedYears.length > 0) {
          setSelectedYear(sortedYears[sortedYears.length - 1]);
        }
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load or process data:", err);
        setError(`Gagal memuat atau memproses data: ${err.message}. Pastikan file CSV tersedia di path yang benar.`);
        setIsLoading(false);
      });
  }, []); // Empty dependency array means this effect runs once on mount

  // Prepare data for Nivo Scatter Plot
  const chartData = useMemo(() => {
    if (!processedData.length || !selectedYear) {
      return [];
    }

    const filteredByYear = processedData.filter((d) => d.tahun === selectedYear);

    // Group data by kota for Nivo scatter plot format (each kota is a series)
    const groupedByKota = filteredByYear.reduce((acc, curr) => {
      if (!acc[curr.kota]) {
        acc[curr.kota] = {
          id: curr.kota, // Series ID is the city name
          data: [],
        };
      }
      acc[curr.kota].data.push({
        x: curr.total_faskes, // X-axis: Total facilities
        y: curr.angka_harapan_hidup, // Y-axis: Life Expectancy
        kota: curr.kota,
        tahun: curr.tahun,
      });
      return acc;
    }, {});

    return Object.values(groupedByKota);
  }, [processedData, selectedYear]);

  // Loading, Error, and No Data states
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
        <div className="text-red-600 text-lg font-semibold p-4 border border-red-300 bg-red-50 rounded-lg shadow-md text-center">
          <p className="mb-2">Error: {error}</p>
          <p>Mohon periksa konsol browser untuk detail lebih lanjut.</p>
          <p className="text-sm mt-2">Pastikan kedua file CSV tersedia di root folder aplikasi.</p>
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
              Hubungan Ketersediaan Fasilitas Kesehatan dan Angka Harapan Hidup
            </h2>
            <p className="text-md text-gray-600">
              Analisis korelasi antar kabupaten/kota di Jawa Barat.
            </p>
          </div>
          <div className="relative inline-block text-left w-full sm:w-auto">
            <label htmlFor="year-select" className="block text-sm font-medium text-gray-700 mb-1">
              Pilih Tahun:
            </label>
            <select
              id="year-select"
              className="border border-gray-300 px-4 py-2 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-gray-700 hover:border-gray-400 transition duration-150 ease-in-out w-full sm:w-auto"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              {availableYears.length > 0 ? (
                availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))
              ) : (
                <option value="">Tidak ada tahun tersedia</option>
              )}
            </select>
          </div>
        </div>

        <div style={{ height: 800 }} className="w-full">
          {chartData.length > 0 ? (
            <ResponsiveScatterPlot
              data={chartData}
              margin={{ top: 60, right: 200, bottom: 90, left: 90 }}
              xScale={{ type: "linear", min: 0, max: "auto" }} // X-axis for facility count
              yScale={{ type: "linear", min: "auto", max: "auto" }} // Y-axis for life expectancy
              blendMode="multiply" // Good for overlapping points
              axisTop={null}
              axisRight={null}
              axisBottom={{
                tickSize: 5,
                tickPadding: 5,
                tickRotation: 0,
                legend: "Total Jumlah Fasilitas Kesehatan (Unit)",
                legendPosition: "middle",
                legendOffset: 50,
              }}
              axisLeft={{
                tickSize: 5,
                tickPadding: 5,
                tickRotation: 0,
                legend: "Angka Harapan Hidup (Tahun)",
                legendPosition: "middle",
                legendOffset: -70,
              }}
              nodeSize={12} // Adjust point size
              colors={{ scheme: "category10" }} // Different colors for different cities
              tooltip={({ node }) => (
                <div
                  style={{
                    background: "white",
                    padding: "10px 14px",
                    border: "1px solid #ccc",
                    borderRadius: 6,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                  className="font-inter text-sm"
                >
                  <strong>Kabupaten/Kota: {node.data.kota}</strong> <br />
                  Tahun: {node.data.tahun} <br />
                  Total Faskes: {node.data.x} unit <br />
                  Angka Harapan Hidup: {node.data.y.toFixed(2)} tahun
                </div>
              )}
              legends={[
                {
                  anchor: "bottom-right",
                  direction: "column",
                  justify: false,
                  translateX: 120,
                  translateY: 0,
                  itemWidth: 100,
                  itemHeight: 20,
                  itemsSpacing: 4,
                  itemDirection: "left-to-right",
                  symbolSize: 12,
                  symbolShape: "circle",
                  effects: [
                    {
                      on: "hover",
                      style: {
                        itemOpacity: 1,
                      },
                    },
                  ],
                },
              ]}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              Tidak ada data yang tersedia untuk tahun {selectedYear}.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

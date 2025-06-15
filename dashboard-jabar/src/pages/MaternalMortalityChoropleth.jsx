import React, { useEffect, useState, useRef, useMemo } from "react";
import * as d3 from "d3"; // Import D3.js
import Papa from "papaparse"; // Import PapaParse for CSV

export default function MaternalMortalityD3Map() {
  const svgRef = useRef(null); // Reference to the SVG element
  const tooltipRef = useRef(null); // Reference to the tooltip element

  const [rawData, setRawData] = useState([]);
  const [geoJsonData, setGeoJsonData] = useState(null);
  const [selectedYear, setSelectedYear] = useState("");
  const [availableYears, setAvailableYears] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- PENTING: URL untuk Data GeoJSON ---
  // Ganti placeholder ini dengan URL GeoJSON yang sebenarnya
  // yang berisi batas-batas kabupaten/kota di Jawa Barat.
  // Jika file GeoJSON Anda ada di folder `public` Vite, gunakan path seperti ini:
  const GEOJSON_URL = "/Jabar_By_Kab.geojson"; // <=== GANTI INI DENGAN PATH GEOJSON ASLI ANDA

  const CSV_URL = "/dinkes-od_19830_jumlah_kematian_ibu_nifas_v1_data.csv";

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    // Fetch both CSV and GeoJSON concurrently
    Promise.all([
      fetch(CSV_URL),
      fetch(GEOJSON_URL)
    ])
      .then(async ([csvRes, geoJsonRes]) => {
        if (!csvRes.ok) throw new Error(`HTTP error! Status: ${csvRes.status} for CSV data.`);
        if (!geoJsonRes.ok) {
          // If GeoJSON not found, warn but don't stop execution
          console.warn(`GeoJSON not found at ${GEOJSON_URL}. Map features will not be displayed.`);
          setError(prev => prev ? prev + " | File GeoJSON tidak ditemukan/tidak dapat diakses." : "File GeoJSON tidak ditemukan/tidak dapat diakses. Fitur peta tidak akan ditampilkan.");
          // Continue to load CSV even if GeoJSON fails
          return [await csvRes.text(), null];
        }
        return [await csvRes.text(), await geoJsonRes.json()];
      })
      .then(([csvText, geoJsonObj]) => {
        // Parse CSV data
        Papa.parse(csvText, {
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
                nama_kabupaten_kota: row.nama_kabupaten_kota?.trim(),
                jumlah_kematian: parseInt(row.jumlah_kematian),
                tahun: row.tahun?.trim(),
                provinsi: row.nama_provinsi?.trim(),
              }))
              .filter(
                (r) =>
                  r.provinsi === "JAWA BARAT" &&
                  !isNaN(r.jumlah_kematian) &&
                  r.nama_kabupaten_kota &&
                  r.tahun
              );

            const uniqueYears = [...new Set(cleaned.map((r) => r.tahun))].sort(
              (a, b) => b - a
            );

            setRawData(cleaned);
            setAvailableYears(uniqueYears);
            if (uniqueYears.length > 0) {
              setSelectedYear(uniqueYears[0]); // Set latest year as default
            }

            if (geoJsonObj) {
              // Pre-process GeoJSON: ensure 'id' property for matching
              const processedGeoJson = {
                ...geoJsonObj,
                features: geoJsonObj.features.map(feature => {
                  if (!feature.id && feature.properties && feature.properties.name) {
                    feature.id = feature.properties.name.trim(); // Use 'name' as ID if 'id' is missing
                  } else if (feature.id) {
                    feature.id = feature.id.trim(); // Trim ID just in case
                  }
                  return feature;
                })
              };
              setGeoJsonData(processedGeoJson);
            }
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
          `Gagal memuat data: ${err.message}. Pastikan file CSV dan GeoJSON tersedia di path yang benar.`
        );
        setIsLoading(false);
      });
  }, []); // Runs once on component mount

  // Effect for D3 drawing when data or selectedYear changes
  useEffect(() => {
    if (!geoJsonData || !rawData.length || !selectedYear || !svgRef.current) {
      return; // Don't draw if data is not ready
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous map elements

    const width = svg.node().getBoundingClientRect().width;
    const height = svg.node().getBoundingClientRect().height;

    const filteredByYear = rawData.filter((d) => d.tahun === selectedYear);

    const aggregatedData = filteredByYear.reduce((acc, curr) => {
      const kotaId = curr.nama_kabupaten_kota;
      if (!acc[kotaId]) {
        acc[kotaId] = 0;
      }
      acc[kotaId] += curr.jumlah_kematian;
      return acc;
    }, {});

    const values = Object.values(aggregatedData);
    const maxVal = values.length > 0 ? Math.max(...values) : 1;
    const minVal = values.length > 0 ? Math.min(...values) : 0;

    const colorScale = d3.scaleSequential()
      .domain([minVal, maxVal === 0 ? 1 : maxVal])
      .interpolator(d3.interpolateReds);

    // Adjust projection for Jawa Barat. You might need to fine-tune `center` and `scale`.
    // This is a common approach for fitting a specific region.
    const projection = d3.geoMercator()
      .fitSize([width, height], geoJsonData); // Fit map to SVG size based on the entire GeoJSON bounds

    const path = d3.geoPath().projection(projection);

    svg.append("g")
      .selectAll("path")
      .data(geoJsonData.features)
      .enter().append("path")
      .attr("d", path)
      .attr("fill", (d) => {
        const kotaName = d.properties.name || d.id;
        const value = aggregatedData[kotaName];
        return value !== undefined ? colorScale(value) : "#ccc"; // Grey for no data
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.5)
      .on("mouseover", function(event, d) {
        const kotaName = d.properties.name || d.id;
        const value = aggregatedData[kotaName];
        const displayValue = value !== undefined ? value : "Tidak Tersedia";

        // Show tooltip
        d3.select(tooltipRef.current)
          .html(`<strong>${kotaName}</strong><br/>Tahun: ${selectedYear}<br/>Kematian Ibu: ${displayValue} jiwa`)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 28) + "px")
          .style("opacity", 1);

        // Highlight feature on hover
        d3.select(this)
          .attr("fill", (d) => {
            const highlightValue = aggregatedData[kotaName];
            return highlightValue !== undefined ? d3.rgb(colorScale(highlightValue)).darker(0.5) : "#999";
          })
          .attr("stroke", "#000")
          .attr("stroke-width", 1.5);
      })
      .on("mouseout", function(event, d) {
        // Hide tooltip
        d3.select(tooltipRef.current).style("opacity", 0);

        // Revert to original style on mouseout
        d3.select(this)
          .attr("fill", (d) => {
            const kotaName = d.properties.name || d.id;
            const value = aggregatedData[kotaName];
            return value !== undefined ? colorScale(value) : "#ccc";
          })
          .attr("stroke", "#fff")
          .attr("stroke-width", 0.5);
      });

    // Add a simple legend
    const legendWidth = 200;
    const legendHeight = 20;
    const legend = svg.append("g")
      .attr("transform", `translate(${width - legendWidth - 20}, ${height - legendHeight - 20})`);

    const legendScale = d3.scaleLinear()
      .domain([minVal, maxVal === 0 ? 1 : maxVal])
      .range([0, legendWidth]);

    legend.selectAll("rect")
      .data(d3.range(0, legendWidth, legendWidth / 10))
      .enter().append("rect")
      .attr("x", (d, i) => i * (legendWidth / 10))
      .attr("y", 0)
      .attr("width", legendWidth / 10)
      .attr("height", legendHeight)
      .attr("fill", d => colorScale(legendScale.invert(d)));

    legend.append("text")
      .attr("x", 0)
      .attr("y", -5)
      .attr("fill", "#333")
      .style("font-size", "10px")
      .text(`${minVal} jiwa`);

    legend.append("text")
      .attr("x", legendWidth)
      .attr("y", -5)
      .attr("text-anchor", "end")
      .attr("fill", "#333")
      .style("font-size", "10px")
      .text(`${maxVal} jiwa`);

    legend.append("text")
      .attr("x", legendWidth / 2)
      .attr("y", -20)
      .attr("text-anchor", "middle")
      .attr("fill", "#333")
      .style("font-size", "12px")
      .text("Jumlah Kematian Ibu");

  }, [rawData, geoJsonData, selectedYear]); // Re-draw map when these dependencies change

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
          <p className="text-sm mt-2">Pastikan file CSV dan GeoJSON tersedia di root folder aplikasi.</p>
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
              Pemetaan Angka Kematian Ibu di Jawa Barat
            </h2>
            <p className="text-md text-gray-600">
              Distribusi jumlah kematian ibu di kabupaten/kota Jawa Barat.
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

        <div className="relative w-full rounded-lg overflow-hidden border border-gray-300 shadow-md" style={{ height: '600px' }}>
          <svg ref={svgRef} className="w-full h-full"></svg>
          {/* Tooltip element, controlled by D3 */}
          <div
            ref={tooltipRef}
            className="tooltip absolute p-2 bg-white border border-gray-300 rounded-md shadow-lg pointer-events-none opacity-0 transition-opacity duration-200 ease-in-out"
            style={{ zIndex: 1000 }}
          ></div>
        </div>

        <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="text-lg font-semibold text-blue-800 mb-2">Catatan Penting:</h3>
          <ul className="list-disc list-inside text-gray-700 space-y-1">
            <li>
              <span className="font-medium text-red-700">Instalasi:</span>
              <br />
              Untuk D3.js dan PapaParse, Anda perlu menginstal paket-paket berikut:
              `npm install d3 papaparse`
            </li>
            <li>
              <span className="font-medium text-red-700">Membutuhkan Data GeoJSON/TopoJSON:</span>
              <br />
              Peta ini tidak akan menampilkan batas-batas geografis yang sebenarnya sampai Anda
              menyediakan file GeoJSON atau TopoJSON yang valid untuk 27 kabupaten/kota di Jawa Barat.
              Ganti `GEOJSON_URL` di dalam kode dengan path/URL ke file GeoJSON Anda.
              Pastikan properti `id` atau `name` dalam setiap fitur GeoJSON cocok dengan `nama_kabupaten_kota` di CSV Anda.
              Anda bisa mencari data GeoJSON ini di situs data pemerintah atau repositori geospasial.
            </li>
            <li>
              <span className="font-medium text-red-700">Metrik Data: Jumlah Kematian Ibu:</span>
              <br />
              Data CSV yang tersedia hanya menyediakan `jumlah_kematian` (jumlah jiwa), bukan "angka kematian ibu per 100.000 kelahiran hidup". Visualisasi ini memetakan jumlah kematian absolut. Untuk memetakan angka per 100.000 kelahiran hidup, Anda memerlukan data jumlah kelahiran hidup per kabupaten/kota per tahun.
            </li>
            <li>
              <span className="font-medium">Filter Tahun:</span> Gunakan *dropdown* "Pilih Tahun" untuk melihat distribusi jumlah kematian ibu di tahun yang berbeda.
            </li>
            <li>
              <span className="font-medium">Interaksi Hover:</span> Arahkan kursor ke wilayah peta (setelah GeoJSON dimuat) untuk melihat detail jumlah kematian ibu per kabupaten/kota. Wilayah akan disorot saat di-*hover*.
            </li>
            <li>
              <span className="font-medium">Fitur Zoom:</span> D3.js mendukung fitur *zoom*, namun implementasinya sedikit lebih kompleks dan tidak disertakan dalam contoh dasar ini.
            </li>
            <li>
              <span className="font-medium">Perbandingan dengan Target SDGs:</span>
              <br />
              Target SDGs untuk Angka Kematian Ibu (MMR) adalah kurang dari 70 per 100.000 kelahiran hidup pada tahun 2030 (SDG 3.1). Perbandingan langsung dengan target ini tidak dapat dilakukan pada grafik ini karena data yang ditampilkan adalah jumlah absolut, bukan rasio per 100.000 kelahiran hidup.
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

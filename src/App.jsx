import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import axios from "axios";

const wheelchairIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/979/979585.png",
  iconSize: [32, 32],
});

function saveToFile(place) {
  const blob = new Blob([JSON.stringify(place, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${place.name.replace(/\s+/g, "_")}_${place.id}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function MapClickHandler({ onClick }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng);
    },
  });
  return null;
}

export default function App() {
  const [places, setPlaces] = useState([]);
  const [filteredPlaces, setFilteredPlaces] = useState([]);
  const [isSearchActive, setIsSearchActive] = useState(false);

  const [formData, setFormData] = useState({
    name: "", lat: "", lon: "", type: "", rating: "", review: "", image: "",
    link: "", contact: "", city: "", caza: "", province: "",
    parking: "no", entrance: "no", seating: "no", toilet: "no",
  });

  const [search, setSearch] = useState({
    name: "", city: "", rating: "",
    parking: false, entrance: false, seating: false, toilet: false,
  });

  // ✅ Load Overpass + manual places once and cleanly
  useEffect(() => {
    const loadPlaces = async () => {
      const manualPlaces = JSON.parse(localStorage.getItem("manualPlaces")) || [];

      const query = `
        [out:json][timeout:25];
        area[name="Lebanon"]->.searchArea;
        (
          node["amenity"~"restaurant|cafe"]["wheelchair"="yes"](area.searchArea);
        );
        out center;
      `;

      try {
        const res = await axios.post(
          "https://overpass-api.de/api/interpreter",
          `data=${encodeURIComponent(query)}`,
          { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );

        const fetched = res.data.elements.map((el) => ({
          id: el.id,
          name: el.tags.name || "Unnamed",
          lat: el.lat,
          lon: el.lon,
          type: el.tags.amenity || "Unknown",
          city: "",
          rating: 0,
          parking: "no",
          entrance: "no",
          seating: "no",
          toilet: "no",
        }));

        setPlaces([...fetched, ...manualPlaces]);
      } catch (err) {
        console.error("Error fetching from Overpass:", err);
        setPlaces(manualPlaces); // fallback
      }
    };

    loadPlaces();
  }, []);

  useEffect(() => {
    setFilteredPlaces(places);
  }, [places]);

  useEffect(() => {
    if (isSearchActive) applyFilters();
  }, [search]);

  const applyFilters = () => {
    const nameTooShort = search.name.length > 0 && search.name.length < 3;
    const cityTooShort = search.city.length > 0 && search.city.length < 3;

    if (nameTooShort || cityTooShort) {
      setFilteredPlaces([]);
      return;
    }

    const result = places.filter((p) => {
      const matchName = search.name.length >= 3
        ? (p.name || "").toLowerCase().includes(search.name.toLowerCase())
        : true;

      const matchCity = search.city.length >= 3
        ? (p.city || "").toLowerCase().includes(search.city.toLowerCase())
        : true;

      const matchRating = search.rating && !isNaN(Number(search.rating)) && Number(search.rating) >= 1
        ? Number(p.rating || 0) >= Number(search.rating)
        : true;

      const matchParking = search.parking ? p.parking === "yes" : true;
      const matchEntrance = search.entrance ? p.entrance === "yes" : true;
      const matchSeating = search.seating ? p.seating === "yes" : true;
      const matchToilet = search.toilet ? p.toilet === "yes" : true;

      return (
        matchName &&
        matchCity &&
        matchRating &&
        matchParking &&
        matchEntrance &&
        matchSeating &&
        matchToilet
      );
    });

    setFilteredPlaces(result);
  };

  const addPlace = () => {
    const {
      name, lat, lon, type, image, link, contact,
      city, caza, province,
      parking, entrance, seating, toilet,
    } = formData;

    if (!name || !lat || !lon || !type) return;

    const yesCount = [parking, entrance, seating, toilet].filter(v => v === "yes").length;
    const autoRating = Math.min(5, 1 + yesCount);

    const autoReview = [
      parking === "yes" ? "✅ Accessible parking" : "❌ No accessible parking",
      entrance === "yes" ? "✅ Accessible entrance" : "❌ No accessible entrance",
      seating === "yes" ? "✅ Accessible seating" : "❌ No accessible seating",
      toilet === "yes" ? "✅ Accessible toilet" : "❌ No accessible toilet",
    ].join("\n");

    const newPlace = {
      id: Date.now(),
      name, lat: parseFloat(lat), lon: parseFloat(lon), type, image, link, contact,
      city, caza, province,
      rating: autoRating,
      review: autoReview,
      parking, entrance, seating, toilet,
    };

    const updatedPlaces = [...places, newPlace];
    setPlaces(updatedPlaces);

    const stored = JSON.parse(localStorage.getItem("manualPlaces")) || [];
    localStorage.setItem("manualPlaces", JSON.stringify([...stored, newPlace]));

    saveToFile(newPlace);

    setFormData({
      name: "", lat: "", lon: "", type: "", rating: "", review: "", image: "",
      link: "", contact: "", city: "", caza: "", province: "",
      parking: "no", entrance: "no", seating: "no", toilet: "no",
    });
  };

  const updateRating = (id, newRating) => {
    const updated = places.map((p) => p.id === id ? { ...p, rating: parseInt(newRating) } : p);
    setPlaces(updated);

    const stored = JSON.parse(localStorage.getItem("manualPlaces")) || [];
    const newStored = stored.map((p) => p.id === id ? { ...p, rating: parseInt(newRating) } : p);
    localStorage.setItem("manualPlaces", JSON.stringify(newStored));
  };

  const deletePlace = (id) => {
    const updated = places.filter((p) => p.id !== id);
    setPlaces(updated);
    const stored = JSON.parse(localStorage.getItem("manualPlaces")) || [];
    const newStored = stored.filter((p) => p.id !== id);
    localStorage.setItem("manualPlaces", JSON.stringify(newStored));
  };

  const handleMapClick = ({ lat, lng }) => {
    setFormData((prev) => ({ ...prev, lat: lat.toFixed(6), lon: lng.toFixed(6) }));
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <h1 className="text-3xl font-bold mb-2 text-center text-blue-700">More Accessible Lebanon</h1>
      <p className="text-center text-gray-600 mb-6 max-w-3xl mx-auto">
        Discover and share wheelchair-accessible cafés, restaurants, and public spaces across Lebanon.
        Help build a more inclusive country by adding places and rating their accessibility features.
      </p>

      <div className="mb-6 bg-white p-6 rounded shadow border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8 max-w-7xl mx-auto">
          <input className="border p-6 text-2xl rounded w-full h-20" placeholder="🔍 Search by name" value={search.name} onChange={(e) => {
            setIsSearchActive(true);
            setSearch({ ...search, name: e.target.value });
          }} />
          <input className="border p-6 text-2xl rounded w-full h-20" placeholder="🏙️ Search by city (min 3 letters)" value={search.city} onChange={(e) => {
            setIsSearchActive(true);
            setSearch({ ...search, city: e.target.value });
          }} />
          <input className="border p-6 text-2xl rounded w-full h-20" type="number" min="1" max="5" placeholder="⭐ Min rating" value={search.rating} onChange={(e) => {
            setIsSearchActive(true);
            setSearch({ ...search, rating: e.target.value });
          }} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
          {["parking", "entrance", "seating", "toilet"].map((feature) => (
            <label key={feature} className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={search[feature]}
                onChange={(e) => {
                  setIsSearchActive(true);
                  setSearch({ ...search, [feature]: e.target.checked });
                }}
              />
              <span>{{
                parking: "🅿️ Accessible Parking",
                entrance: "🚪 Accessible Entrance",
                seating: "🪑 Accessible Seating",
                toilet: "🚻 Accessible Toilet",
              }[feature]}</span>
            </label>
          ))}
        </div>

        <div className="flex justify-center gap-4">
          <button className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-6 rounded shadow-md" onClick={() => {
            setIsSearchActive(true);
            applyFilters();
          }}>🔍 Search</button>

          <button className="bg-gray-400 hover:bg-gray-500 text-white py-2 px-6 rounded shadow-md" onClick={() => {
            setSearch({ name: "", city: "", rating: "", parking: false, entrance: false, seating: false, toilet: false });
            setFilteredPlaces(places);
            setIsSearchActive(false);
          }}>♻️ Reset</button>
        </div>
      </div>

      <div className="mb-4 text-gray-700 font-medium">Showing {filteredPlaces.length} result(s)</div>

      <MapContainer center={[33.8547, 35.8623]} zoom={8} style={{ height: "80vh", borderRadius: "12px", overflow: "hidden" }}>
        <MapClickHandler onClick={handleMapClick} />
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {(isSearchActive ? filteredPlaces : places).map((place) => (
          <Marker key={place.id} position={[place.lat, place.lon]} icon={wheelchairIcon}>
            <Popup>
              <b>{place.name}</b><br />{place.type}
              {place.city && <><br />🏙️ City: {place.city}</>}
              {place.caza && <><br />🏞️ Caza: {place.caza}</>}
              {place.province && <><br />🗺️ Province: {place.province}</>}
              {place.contact && <><br />📞 Contact: {place.contact}</>}
              <br />⭐ {place.rating}/5
              <br /><br />
              <div>
                🅿️ Parking: {place.parking === "yes" ? "✅" : "❌"}<br />
                🚪 Entrance: {place.entrance === "yes" ? "✅" : "❌"}<br />
                🪑 Seating: {place.seating === "yes" ? "✅" : "❌"}<br />
                🚻 Toilet: {place.toilet === "yes" ? "✅" : "❌"}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

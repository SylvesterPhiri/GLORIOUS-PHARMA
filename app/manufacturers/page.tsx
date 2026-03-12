
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Manufacturer } from "@/src/lib/api";
import { fetchManufacturers, deleteManufacturer } from "@/src/lib/api";

export default function ManufacturersPage() {
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

  useEffect(() => {
    loadManufacturers();
  }, []);

  const loadManufacturers = async () => {
    try {
      setLoading(true);
      const data = await fetchManufacturers(searchTerm);
      setManufacturers(data);
    } catch (error) {
      console.error("Error loading manufacturers:", error);
      alert("Failed to load manufacturers");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadManufacturers();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this manufacturer?")) return;
    
    try {
      setDeleteLoading(id);
      await deleteManufacturer(id);
      setManufacturers(manufacturers.filter(manufacturer => manufacturer.id !== id));
    } catch (error: any) {
      console.error("Error deleting manufacturer:", error);
      alert(error.message || "Failed to delete manufacturer");
    } finally {
      setDeleteLoading(null);
    }
  };

  const stats = {
    total: manufacturers.length,
    withMotherCompany: manufacturers.filter(m => m.motherCompany).length,
    withProducts: 0, // You'll need to update this when you have products
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        
        {}
        <div className="mb-8">
          <div className="flex items-center space-x-2 mb-4">
            <Link href="/" className="text-blue-600 hover:text-blue-800 flex items-center">
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Dashboard
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-gray-600 font-medium">Manufacturers</span>
          </div>

          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
                Manufacturers
              </h1>
              <p className="text-gray-600 mt-2">Manage medicine manufacturers and suppliers</p>
            </div>
            <Link
              href="/manufacturers/add"
              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Manufacturer
            </Link>
          </div>
        </div>

        {}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-2xl p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <div className="text-sm text-gray-500">Total Manufacturers</div>
                <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <div>
                <div className="text-sm text-gray-500">With Parent Company</div>
                <div className="text-2xl font-bold text-gray-900">{stats.withMotherCompany}</div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl shadow-2xl p-6 text-white">
            <div className="flex items-center">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mr-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div>
                <div className="text-sm text-purple-100">Products Linked</div>
                <div className="text-2xl font-bold">{stats.withProducts}</div>
              </div>
            </div>
          </div>
        </div>

        {}
        <div className="bg-white rounded-2xl shadow-2xl p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4 justify-between">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Search Manufacturers</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Search by name, contact person, or company..."
                    className="w-full px-4 py-3 pl-10 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                  <svg className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <button
                  onClick={handleSearch}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all font-medium"
                >
                  Search
                </button>
              </div>
            </div>
          </div>
        </div>

        {}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900">Manufacturer List</h2>
          </div>

          {manufacturers.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">🏭</div>
              <p className="text-gray-500 text-lg mb-4">No manufacturers found</p>
              {searchTerm ? (
                <p className="text-gray-400">Try changing your search filters</p>
              ) : (
                <Link
                  href="/manufacturers/add"
                  className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Manufacturer
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Manufacturer
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact Info
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Parent Company
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {manufacturers.map((manufacturer) => (
                    <tr key={manufacturer.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900">{manufacturer.name}</div>
                        {manufacturer.contactPerson && (
                          <div className="text-sm text-gray-500 mt-1 flex items-center">
                            <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            {manufacturer.contactPerson}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          {manufacturer.email && (
                            <div className="text-sm text-gray-900 flex items-center">
                              <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                              {manufacturer.email}
                            </div>
                          )}
                          {manufacturer.phone && (
                            <div className="text-sm text-gray-500 flex items-center">
                              <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                              </svg>
                              {manufacturer.phone}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {manufacturer.motherCompany ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                            {manufacturer.motherCompany}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">None</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {manufacturer.location ? (
                          <div className="text-sm text-gray-900 flex items-center">
                            <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {manufacturer.location}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">Not specified</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <Link
                            href={`/manufacturers/${manufacturer.id}`}
                            className="text-blue-600 hover:text-blue-800 font-medium text-sm flex items-center"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            View
                          </Link>
                          <Link
                            href={`/manufacturers/${manufacturer.id}/edit`}
                            className="text-green-600 hover:text-green-800 font-medium text-sm flex items-center"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit
                          </Link>
                          <button
                            onClick={() => handleDelete(manufacturer.id)}
                            disabled={deleteLoading === manufacturer.id}
                            className={`text-red-600 hover:text-red-800 font-medium text-sm flex items-center ${
                              deleteLoading === manufacturer.id ? "opacity-50 cursor-not-allowed" : ""
                            }`}
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            {deleteLoading === manufacturer.id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
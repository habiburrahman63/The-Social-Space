/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ShoppingBag, Search, MapPin, Tag, Plus, Trash2, MessageSquare, X } from 'lucide-react';
import { MarketplaceItem, User } from '../types';
import { api } from '../utils/api';

const CATEGORIES = ['All', 'Electronics & Office', 'Hobbies & Cameras', 'Home & Living', 'Clothing & Apparel'];

interface MarketplaceProps {
  currentUser: User;
  onNavigate: (view: string, targetId?: string) => void;
}

export default function Marketplace({ currentUser, onNavigate }: MarketplaceProps) {
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Search/Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLocation, setSearchLocation] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // New item form modal state
  const [showFormModal, setShowFormModal] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formCategory, setFormCategory] = useState('Electronics & Office');
  const [formLocation, setFormLocation] = useState('San Francisco, CA');
  const [formImage, setFormImage] = useState('');

  const fetchMarketplace = async () => {
    try {
      setLoading(true);
      const catQuery = selectedCategory !== 'All' ? `category=${selectedCategory}` : '';
      const searchQueryString = searchQuery ? `&q=${searchQuery}` : '';
      const locQuery = searchLocation ? `&location=${searchLocation}` : '';
      
      const res = await api.get(`/api/marketplace?${catQuery}${searchQueryString}${locQuery}`);
      setItems(res?.items || []);
    } catch (_) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarketplace();
  }, [selectedCategory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchMarketplace();
  };

  const handleCreateListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle || !formPrice || !formImage) {
      alert('Title, price, and image URL are required.');
      return;
    }

    try {
      await api.post('/api/marketplace', {
        title: formTitle,
        description: formDescription,
        price: Number(formPrice),
        category: formCategory,
        location: formLocation,
        mediaUrls: [formImage]
      });

      // Clear Form and close modal
      setFormTitle('');
      setFormDescription('');
      setFormPrice('');
      setFormImage('');
      setShowFormModal(false);

      fetchMarketplace();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteListing = async (id: string) => {
    if (!confirm('Are you sure you want to delete this listing?')) return;
    try {
      await api.delete(`/api/marketplace/${id}`);
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 md:px-6 max-w-5xl mx-auto space-y-6 bg-gray-50/30 dark:bg-gray-950 transition-colors">
      
      {/* Page Title & Sell Trigger row */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-4 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-6 w-6 text-blue-600" />
          <h1 className="text-xl font-black text-gray-900 dark:text-white">Marketplace</h1>
        </div>
        <button
          onClick={() => setShowFormModal(true)}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 cursor-pointer active:scale-95 transition"
        >
          <Plus className="h-4 w-4" />
          <span>Create New Listing</span>
        </button>
      </div>

      {/* Search and Location Form Filter bar */}
      <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search Marketplace products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-10 pr-4 text-xs text-gray-900 placeholder-gray-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
          />
        </div>

        <div className="relative w-full md:w-56">
          <MapPin className="absolute left-3 top-2.5 h-4.5 w-4.5 text-red-500" />
          <input
            type="text"
            placeholder="Location filter..."
            value={searchLocation}
            onChange={(e) => setSearchLocation(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-10 pr-4 text-xs text-gray-900 placeholder-gray-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
          />
        </div>

        <button
          type="submit"
          className="rounded-xl bg-gray-900 px-5 py-2 text-xs font-bold text-white hover:bg-black dark:bg-blue-600 dark:hover:bg-blue-700 transition cursor-pointer"
        >
          Apply Filters
        </button>
      </form>

      {/* Horizontal categories selectors */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin select-none">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition shrink-0 cursor-pointer ${
              selectedCategory === cat
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Product Listings grid */}
      {loading ? (
        <div className="py-12 text-center text-sm font-semibold animate-pulse">
          Loading catalog items...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 p-12 text-center text-sm text-gray-500 dark:border-gray-800">
          No marketplace items match your search. Be the first to publish a listing!
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map(item => {
            const isOwnListing = item.sellerId === currentUser.id;
            return (
              <div
                key={item.id}
                className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-xs dark:border-gray-800 dark:bg-gray-900 flex flex-col justify-between"
              >
                {/* Product photo with price overlay */}
                <div className="relative h-44 w-full bg-gray-50 dark:bg-gray-950">
                  <img loading="lazy"
                    src={item.mediaUrls[0] || 'https://images.unsplash.com/photo-1595515106969-1ce29566ff1c?w=600'}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600';
                    }}
                  />
                  <div className="absolute bottom-3 left-3 rounded-lg bg-gray-900/95 px-2.5 py-1 text-xs font-extrabold text-white">
                    ${item.price}
                  </div>
                </div>

                {/* Product description content */}
                <div className="p-3 space-y-2 flex-1 flex flex-col justify-between">
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-gray-900 dark:text-white line-clamp-1">
                      {item.title}
                    </h4>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-1 font-medium">
                      <MapPin className="h-3 w-3" />
                      <span>{item.location}</span>
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  <div className="border-t pt-2.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <img loading="lazy"
                        src={item.sellerAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                        alt={item.sellerName}
                        referrerPolicy="no-referrer"
                        className="h-5.5 w-5.5 rounded-full object-cover"
                      />
                      <span className="text-[10px] text-gray-500 font-bold truncate">
                        {item.sellerName.split(' ')[0]}
                      </span>
                    </div>

                    <div className="flex gap-1">
                      {isOwnListing || currentUser.role === 'admin' ? (
                        <button
                          onClick={() => handleDeleteListing(item.id)}
                          className="rounded-lg p-1.5 text-red-500 bg-red-50/10 border border-red-200 hover:bg-red-50 dark:border-red-950/20"
                          title="Delete Listing"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : null}

                      {!isOwnListing && (
                        <button
                          onClick={() => onNavigate('messenger', item.sellerId)}
                          className="flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-600 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-400"
                        >
                          <MessageSquare className="h-3 w-3" />
                          <span>Chat</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE NEW LISTING DIALOG MODAL */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-gray-900 border">
            <button
              onClick={() => setShowFormModal(false)}
              className="absolute top-4 right-4 rounded-full p-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-base font-black text-gray-900 dark:text-white border-b pb-2 mb-4">Create Marketplace Listing</h2>

            <form onSubmit={handleCreateListing} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-500 mb-1">Item Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Electric Guitar, Standing Desk"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-500 mb-1">Price ($USD)</label>
                  <input
                    type="number"
                    required
                    placeholder="Price in USD"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-500 mb-1">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950"
                  >
                    {CATEGORIES.slice(1).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-500 mb-1">Location</label>
                  <input
                    type="text"
                    required
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-500 mb-1">Image URL</label>
                  <input
                    type="url"
                    required
                    placeholder="https://images.unsplash.com/photo-..."
                    value={formImage}
                    onChange={(e) => setFormImage(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-500 mb-1">Product Description</label>
                <textarea
                  placeholder="Tell buyers about your item condition, reason for sale..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 border-t pt-4">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="rounded-lg bg-gray-100 px-4 py-2 font-bold hover:bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-5 py-2 font-bold text-white hover:bg-blue-700 cursor-pointer"
                >
                  List Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

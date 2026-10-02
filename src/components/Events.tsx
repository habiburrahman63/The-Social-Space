/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, Plus, UserCheck, Heart, X, Sparkles } from 'lucide-react';
import { Event as EventItem, User } from '../types';
import { api } from '../utils/api';

interface EventsProps {
  currentUser: User;
  onNavigate: (view: string, targetId?: string) => void;
}

export default function Events({ currentUser, onNavigate }: EventsProps) {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  // New Event form modal state
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDesc, setEventDesc] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventImage, setEventImage] = useState('');

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/events');
      setEvents(res?.events || []);
    } catch (_) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle || !eventDate || !eventLocation) {
      alert('Title, Date and Location are required.');
      return;
    }

    try {
      await api.post('/api/events', {
        title: eventTitle,
        description: eventDesc,
        date: eventDate,
        time: eventTime,
        location: eventLocation,
        mediaUrl: eventImage || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600'
      });

      // Clear Form and close modal
      setEventTitle('');
      setEventDesc('');
      setEventDate('');
      setEventTime('');
      setEventLocation('');
      setEventImage('');
      setShowEventModal(false);

      fetchEvents();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRespond = async (id: string, response: 'going' | 'interested') => {
    try {
      const res = await api.post(`/api/events/${id}/respond`, { status: response === 'going' ? 'attending' : 'interested' });
      if (res) {
        setEvents(prev => prev.map(e => e.id === id ? { ...e, attending: res.attending || [], interested: res.interested || [] } : e));
      }
    } catch (_) {}
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 md:px-6 max-w-4xl mx-auto space-y-6 bg-gray-50/30 dark:bg-gray-950 transition-colors">
      
      {/* Page Title & Build Trigger row */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-4 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <Calendar className="h-6 w-6 text-blue-600" />
          <h1 className="text-xl font-black text-gray-900 dark:text-white">Upcoming Events</h1>
        </div>
        <button
          onClick={() => setShowEventModal(true)}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 cursor-pointer active:scale-95 transition"
        >
          <Plus className="h-4 w-4" />
          <span>Create Event</span>
        </button>
      </div>

      {/* Grid listing */}
      {loading ? (
        <div className="py-12 text-center text-sm font-semibold animate-pulse">
          Loading events roster...
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 p-12 text-center text-sm text-gray-500 dark:border-gray-800">
          No upcoming events scheduled. Launch a custom meetup or virtual conference above!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {events.map(event => {
            const dateObj = new Date(event.date);
            const isGoing = (event.attending || []).includes(currentUser.id);
            const isInterested = (event.interested || []).includes(currentUser.id);

            return (
              <div
                key={event.id}
                className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-xs dark:border-gray-800 dark:bg-gray-900 flex flex-col justify-between"
              >
                {/* Event banner illustration */}
                <div className="relative h-40 w-full bg-gray-50 dark:bg-gray-950">
                  <img loading="lazy"
                    src={event.mediaUrl || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600'}
                    alt={event.title}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=600';
                    }}
                  />
                  {/* Calendar badge overlay */}
                  <div className="absolute top-3 left-3 rounded-lg bg-white p-2 text-center shadow-xs dark:bg-gray-900 flex flex-col justify-center min-w-[48px]">
                    <span className="text-[9px] uppercase font-black text-red-500 leading-none">
                      {dateObj.toLocaleString('default', { month: 'short' })}
                    </span>
                    <span className="text-base font-black text-gray-900 dark:text-white leading-none mt-1">
                      {dateObj.getDate() || '17'}
                    </span>
                  </div>
                </div>

                {/* Event text metadata */}
                <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-1">
                      <span>{event.title}</span>
                      {event.isOfficial && <Sparkles className="h-3.5 w-3.5 text-yellow-500 fill-current" />}
                    </h3>
                    <p className="text-[10px] text-gray-400 font-bold tracking-wider uppercase">
                      {event.location}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-3 leading-relaxed">
                      {event.description}
                    </p>
                  </div>

                  <div className="border-t pt-3 flex items-center justify-between">
                    <div className="text-[10px] text-gray-400 font-bold">
                      <span>{(event.attending || []).length} Going</span>
                      <span className="mx-1.5">•</span>
                      <span>{(event.interested || []).length} Interested</span>
                    </div>

                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleRespond(event.id, 'going')}
                        className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-bold cursor-pointer transition ${
                          isGoing
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
                        }`}
                      >
                        <UserCheck className="h-3.5 w-3.5" />
                        <span>{isGoing ? 'Going' : 'Going'}</span>
                      </button>

                      <button
                        onClick={() => handleRespond(event.id, 'interested')}
                        className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-bold cursor-pointer transition ${
                          isInterested
                            ? 'bg-rose-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
                        }`}
                      >
                        <Heart className="h-3.5 w-3.5" />
                        <span>{isInterested ? 'Interested' : 'Interested'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE NEW EVENT DIALOG MODAL */}
      {showEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-gray-900 border">
            <button
              onClick={() => setShowEventModal(false)}
              className="absolute top-4 right-4 rounded-full p-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-base font-black text-gray-900 dark:text-white border-b pb-2 mb-4">Create Upcoming Event</h2>

            <form onSubmit={handleCreateEvent} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-500 mb-1">Event Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Summer Code Hackathon, Annual Pizza Hangout"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-500 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-500 mb-1">Time</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 7:00 PM"
                    value={eventTime}
                    onChange={(e) => setEventTime(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-500 mb-1">Location / Map link</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Downtown Park, Zoom Room"
                    value={eventLocation}
                    onChange={(e) => setEventLocation(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-500 mb-1">Image Banner URL</label>
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/photo-..."
                    value={eventImage}
                    onChange={(e) => setEventImage(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-500 mb-1">Meetup Details</label>
                <textarea
                  placeholder="Provide schedule details, what to bring, topics..."
                  value={eventDesc}
                  onChange={(e) => setEventDesc(e.target.value)}
                  className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 border-t pt-4">
                <button
                  type="button"
                  onClick={() => setShowEventModal(false)}
                  className="rounded-lg bg-gray-100 px-4 py-2 font-bold hover:bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-5 py-2 font-bold text-white hover:bg-blue-700 cursor-pointer"
                >
                  Create Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

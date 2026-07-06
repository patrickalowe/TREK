import { useState, useEffect, useCallback } from 'react'
import { Image as ImageIcon, Link2, RefreshCw, X, Loader2 } from 'lucide-react'
import { tripsApi } from '../../api/client'
import { useTripStore } from '../../store/tripStore'
import { useToast } from '../shared/Toast'
import { useTranslation } from '../../i18n'
import { getApiErrorMessage } from '../../utils/apiError'
import type { Trip } from '../../types'

interface AlbumPhoto {
  guid: string
  caption: string
  dateCreated: string | null
  width: number
  height: number
  url: string
  thumbUrl: string
  contributor: string
}

interface PhotosPanelProps {
  tripId: number | string
  trip: Trip | null
  canEdit: boolean
}

export default function PhotosPanel({ tripId, trip, canEdit }: PhotosPanelProps) {
  const { t } = useTranslation()
  const toast = useToast()
  const updateTrip = useTripStore(s => s.updateTrip)

  const albumUrl = trip?.icloud_album_url || ''
  const [photos, setPhotos] = useState<AlbumPhoto[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [urlInput, setUrlInput] = useState(albumUrl)
  const [saving, setSaving] = useState(false)
  const [lightbox, setLightbox] = useState<AlbumPhoto | null>(null)

  useEffect(() => { setUrlInput(albumUrl) }, [albumUrl])

  const loadPhotos = useCallback(async () => {
    if (!albumUrl) { setPhotos([]); return }
    setLoading(true)
    setError(null)
    try {
      const res = await tripsApi.photos(tripId)
      setPhotos(res.album?.photos || [])
    } catch (err) {
      setError(getApiErrorMessage(err, t('photos.loadError')))
      setPhotos([])
    } finally {
      setLoading(false)
    }
  }, [tripId, albumUrl, t])

  useEffect(() => { loadPhotos() }, [loadPhotos])

  const saveUrl = async (value: string | null) => {
    setSaving(true)
    try {
      await updateTrip(tripId, { icloud_album_url: value } as Partial<Trip>)
      if (value) toast.success(t('photos.linkSaved'))
    } catch (err) {
      toast.error(getApiErrorMessage(err, t('common.unknownError')))
    } finally {
      setSaving(false)
    }
  }

  // ── Empty / setup state ────────────────────────────────────────────────────
  if (!albumUrl) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '48px 20px', textAlign: 'center' }}>
        <ImageIcon size={40} style={{ opacity: 0.4, margin: '0 auto 16px' }} />
        <h2 className="text-content" style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{t('photos.emptyTitle')}</h2>
        <p className="text-content-faint" style={{ fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>{t('photos.emptyBody')}</p>
        {canEdit ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="url"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              placeholder="https://www.icloud.com/sharedalbum/#..."
              className="form-input"
              style={{ flex: 1 }}
            />
            <button
              onClick={() => saveUrl(urlInput.trim())}
              disabled={saving || !urlInput.trim()}
              className="bg-accent text-white"
              style={{ padding: '9px 16px', borderRadius: 8, border: 'none', fontWeight: 500, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap', opacity: saving || !urlInput.trim() ? 0.6 : 1 }}
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : t('photos.linkAlbum')}
            </button>
          </div>
        ) : (
          <p className="text-content-faint" style={{ fontSize: 13 }}>{t('photos.noLinkReadonly')}</p>
        )}
      </div>
    )
  }

  // ── Album view ─────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '16px 20px 40px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <span className="text-content" style={{ fontSize: 15, fontWeight: 600 }}>
          {t('photos.count', { count: photos.length })}
        </span>
        <div style={{ flex: 1 }} />
        <button onClick={loadPhotos} className="bg-surface-hover text-content-faint" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: 'none', fontSize: 13, cursor: 'pointer' }}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> {t('photos.refresh')}
        </button>
        {canEdit && (
          <button onClick={() => saveUrl(null)} disabled={saving} className="bg-surface-hover text-content-faint" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: 'none', fontSize: 13, cursor: 'pointer' }}>
            <Link2 size={13} /> {t('photos.unlink')}
          </button>
        )}
      </div>

      {loading && photos.length === 0 && (
        <div style={{ textAlign: 'center', padding: 48 }}><Loader2 className="animate-spin" style={{ margin: '0 auto', opacity: 0.5 }} /></div>
      )}
      {error && <div className="text-content-faint" style={{ padding: 24, textAlign: 'center', fontSize: 14 }}>{error}</div>}

      {photos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
          {photos.map(p => (
            <button
              key={p.guid}
              onClick={() => setLightbox(p)}
              style={{ aspectRatio: '1', border: 'none', padding: 0, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', background: 'var(--bg-hover)' }}
              title={p.caption || (p.dateCreated ? new Date(p.dateCreated).toLocaleDateString() : '')}
            >
              <img src={p.thumbUrl} loading="lazy" alt={p.caption} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </button>
          ))}
        </div>
      )}

      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 999, width: 40, height: 40, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={20} /></button>
          <img src={lightbox.url} alt={lightbox.caption} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }} onClick={e => e.stopPropagation()} />
          {(lightbox.caption || lightbox.dateCreated) && (
            <div style={{ position: 'absolute', bottom: 20, left: 0, right: 0, textAlign: 'center', color: 'white', fontSize: 13, textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
              {lightbox.caption}{lightbox.caption && lightbox.dateCreated ? ' · ' : ''}{lightbox.dateCreated ? new Date(lightbox.dateCreated).toLocaleDateString() : ''}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

"use client";
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
import Button from '@mui/material/Button';

interface AvatarCropperProps {
  open: boolean;
  imageUrl: string; // Object URL or remote URL
  onCancel: () => void;
  onSave: (blob: Blob) => void;
}

// Square cropper with pan/zoom and canvas export
const AvatarCropper: React.FC<AvatarCropperProps> = ({ open, imageUrl, onCancel, onSave }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [imgSize, setImgSize] = useState<{w:number; h:number}>({ w: 0, h: 0 });
  const [containerSize, setContainerSize] = useState(400);
  const [zoom, setZoom] = useState(1.0);
  const [baseScale, setBaseScale] = useState(1.0);
  const [offset, setOffset] = useState<{x:number;y:number}>({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastPos = useRef<{x:number;y:number}>({ x: 0, y: 0 });

  useEffect(() => {
    const img = new Image();
    img.onload = () => setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = imageUrl;
  }, [imageUrl]);

  useEffect(() => {
    if (!imgSize.w || !imgSize.h) return;
    const size = Math.min(560, Math.min(window.innerWidth - 48, window.innerHeight - 160));
    const square = Math.max(320, Math.floor(size));
    setContainerSize(square);
    const scaleToCover = Math.max(square / imgSize.w, square / imgSize.h);
    setBaseScale(scaleToCover);
    setZoom(1.0);
    const displayedW = imgSize.w * scaleToCover;
    const displayedH = imgSize.h * scaleToCover;
    setOffset({ x: (square - displayedW) / 2, y: (square - displayedH) / 2 });
  }, [imgSize]);

  const displayed = useMemo(() => {
    const s = baseScale * zoom;
    return { w: imgSize.w * s, h: imgSize.h * s };
  }, [imgSize, baseScale, zoom]);

  const clampOffset = (nx:number, ny:number) => {
    const minX = containerSize - displayed.w;
    const minY = containerSize - displayed.h;
    return { x: Math.min(0, Math.max(minX, nx)), y: Math.min(0, Math.max(minY, ny)) };
  };

  useEffect(() => {
    setOffset(prev => clampOffset(prev.x, prev.y));
  }, [zoom, displayed.w, displayed.h]);

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setOffset(prev => clampOffset(prev.x + dx, prev.y + dy));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    dragging.current = false;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  };

  const handleSave = async () => {
    const canvasSize = 512;
    const canvas = document.createElement('canvas');
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;
    await new Promise(resolve => { img.onload = resolve; });
    const s = baseScale * zoom;
    const srcX = Math.max(0, -offset.x / s);
    const srcY = Math.max(0, -offset.y / s);
    const srcW = Math.min(img.width - srcX, containerSize / s);
    const srcH = Math.min(img.height - srcY, containerSize / s);
    ctx?.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, canvasSize, canvasSize);
    canvas.toBlob((blob) => { if (blob) onSave(blob); }, 'image/jpeg', 0.9);
  };

  return (
    <Dialog fullScreen open={open} onClose={onCancel}>
      <AppBar sx={{ position: 'relative', bgcolor: '#894991' }}>
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={onCancel} aria-label="close">
            <CloseIcon />
          </IconButton>
          <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">
            Recadrer la photo de profil
          </Typography>
          <Button color="inherit" startIcon={<CheckIcon />} onClick={handleSave}>
            Enregistrer
          </Button>
        </Toolbar>
      </AppBar>
      <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <Box
          ref={containerRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          sx={{
            width: containerSize,
            height: containerSize,
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            position: 'relative',
            overflow: 'hidden',
            touchAction: 'none',
            background: '#000'
          }}
        >
          <Box sx={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', background: 'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
          <img
            src={imageUrl}
            alt="Prévisualisation"
            draggable={false}
            style={{ position: 'absolute', left: offset.x, top: offset.y, width: `${displayed.w}px`, height: `${displayed.h}px`, userSelect: 'none' }}
          />
        </Box>
        <Box sx={{ width: containerSize, maxWidth: '90vw' }}>
          <Typography gutterBottom>Zoom</Typography>
          <Slider value={zoom} onChange={(_, v) => setZoom(v as number)} min={1} max={4} step={0.01} />
        </Box>
      </Box>
    </Dialog>
  );
};

export default AvatarCropper;

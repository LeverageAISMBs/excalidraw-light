import React, { useState, useEffect, useCallback } from 'react';
import { useDebounce, useInterval } from 'react-use';
import { AppLayout } from '@/components/layout/AppLayout';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Toaster, toast } from '@/components/ui/sonner';
import { EditorToolbar } from '@/components/toolbar/EditorToolbar';
import { ExcalidrawCanvas } from '@/components/canvas/ExcalidrawCanvas';
import { LayersPanel } from '@/components/inspector/LayersPanel';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { useDraw } from '@/hooks/use-draw';
import { api } from '@/lib/api-client';
import type { Drawing, Tool, Presence, Op } from '@shared/types';
import { exportToSvg, exportToPng } from '@/lib/drawing';
import { EmptyStateIllustration } from './EditorAssets';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
const initialDrawing: Drawing = { id: '', title: 'Untitled', elements: [], updatedAt: 0, ops: [], opVersion: 0 };
export function HomePage() {
  const [activeTool, setActiveTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#f48018');
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [currentDrawingId, setCurrentDrawingId] = useState<string | null>(null);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [presences, setPresences] = useState<Presence[]>([]);
  const { drawing, elements, setDrawing, undo, redo, canUndo, canRedo, createElement, createStroke, mergeRemoteOps, pendingOps } = useDraw(initialDrawing);
  const loadDrawing = useCallback(async (id: string) => {
    try {
      const loaded = await api<Drawing>(`/api/drawings/${id}`);
      setDrawing(loaded);
      setCurrentDrawingId(id);
      toast.success(`Loaded "${loaded.title}"`);
    } catch (error) {
      toast.error('Failed to load drawing.');
      setCurrentDrawingId(null);
    }
  }, [setDrawing]);
  const loadDrawings = useCallback(async () => {
    try {
      const { items } = await api<{ items: Drawing[] }>('/api/drawings');
      setDrawings(items);
      if (!currentDrawingId && items.length > 0) {
        loadDrawing(items[0].id);
      }
    } catch (error) {
      toast.error('Failed to load drawings.');
    }
  }, [currentDrawingId, loadDrawing]);
  useEffect(() => {
    loadDrawings();
  }, []); // Run only once on mount
  const createNewDrawing = async () => {
    try {
      const newDrawing = await api<Drawing>('/api/drawings', { method: 'POST', body: JSON.stringify({ title: 'New Drawing' }) });
      setDrawings(prev => [newDrawing, ...prev]);
      loadDrawing(newDrawing.id);
    } catch (error) {
      toast.error('Failed to create new drawing.');
    }
  };
  const handleSave = useCallback(async (ops: Op[]) => {
    if (!currentDrawingId || ops.length === 0) return;
    try {
      await api(`/api/drawings/${currentDrawingId}/ops`, {
        method: 'POST',
        body: JSON.stringify(ops),
      });
      // Update local drawing version to match server
      setDrawing({ ...drawing, opVersion: drawing.opVersion + ops.length });
    } catch (error) {
      toast.error('Failed to save changes.');
    }
  }, [currentDrawingId, drawing, setDrawing]);
  useDebounce(() => {
    handleSave(pendingOps);
  }, 2000, [pendingOps, handleSave]);
  useInterval(() => {
    if (!currentDrawingId) return;
    const poll = async () => {
      try {
        const remoteOps = await api<Op[]>(`/api/drawings/${currentDrawingId}/ops?since=${drawing.opVersion}`);
        if (remoteOps.length > 0) {
          const { conflicts } = mergeRemoteOps(remoteOps);
          setDrawing({ ...drawing, opVersion: drawing.opVersion + remoteOps.length });
          if (conflicts > 0) {
            toast.warning('Remote changes detected and merged!');
          } else {
            toast.info('Drawing updated with changes from others.');
          }
        }
        const remotePresences = await api<Presence[]>(`/api/drawings/${currentDrawingId}/presence`);
        setPresences(remotePresences);
      } catch (error) {
        console.error("Polling failed", error);
      }
    };
    poll();
  }, 5000);
  const handleExport = async (format: 'svg' | 'png') => {
    const svgString = exportToSvg({ ...drawing, elements });
    const filename = `${drawing.title}.${format}`;
    if (format === 'svg') {
      const blob = new Blob([svgString], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const dataUrl = await exportToPng(svgString);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename;
      a.click();
    }
    toast.success(`Exported as ${format.toUpperCase()}`);
  };
  return (
    <AppLayout className="h-screen overflow-hidden !p-0">
      <ThemeToggle className="absolute top-4 right-4 z-20" />
      <div className="h-full w-full relative flex flex-col">
        <header className="p-2 border-b flex items-center justify-between z-10 bg-background">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-gradient-to-br from-orange-500 to-amber-500" />
            <span className="font-display text-lg">Paperplane</span>
          </div>
          <div className="text-sm text-muted-foreground">{drawing.title}</div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline">My Drawings</Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Your Drawings</SheetTitle>
              </SheetHeader>
              <Button onClick={createNewDrawing} className="w-full my-4">Create New</Button>
              <ScrollArea className="h-[calc(100%-100px)]">
                <div className="space-y-2">
                  {drawings.map(d => (
                    <div key={d.id} onClick={() => loadDrawing(d.id)} className="p-2 rounded-md hover:bg-accent cursor-pointer border">
                      <p className="font-medium">{d.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Last updated: {new Date(d.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>
        </header>
        <main className="flex-1 relative">
          <EditorToolbar
            activeTool={activeTool}
            onToolChange={setActiveTool}
            color={color}
            onColorChange={setColor}
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
            onSave={() => handleSave(pendingOps)}
            onExport={handleExport}
          />
          {currentDrawingId ? (
            <ResizablePanelGroup direction="horizontal" className="h-full">
              <ResizablePanel defaultSize={80}>
                <ExcalidrawCanvas
                  elements={elements}
                  tool={activeTool}
                  color={color}
                  strokeWidth={strokeWidth}
                  onCreateElement={createElement}
                  onCreateStroke={createStroke}
                  presences={presences}
                />
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={20} minSize={15} maxSize={25}>
                <LayersPanel
                  elements={elements}
                  onReorder={(reordered) => { /* TODO: Implement reorder op */ }}
                  onToggleVisibility={(id) => { /* TODO: Implement visibility op */ }}
                />
              </ResizablePanel>
            </ResizablePanelGroup>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-muted/50">
              <EmptyStateIllustration className="w-64 h-64" />
              <h2 className="text-2xl font-semibold mt-4">Welcome to Paperplane</h2>
              <p className="text-muted-foreground">Create a new drawing or select one to get started.</p>
              <Button onClick={createNewDrawing} className="mt-6">Start Drawing</Button>
            </div>
          )}
        </main>
      </div>
      <Toaster richColors closeButton />
    </AppLayout>
  );
}
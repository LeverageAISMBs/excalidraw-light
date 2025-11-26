import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDebounce, useInterval, useWindowSize } from 'react-use';
import { useHotkeys } from 'react-hotkeys-hook';
import { motion, AnimatePresence } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Toaster, toast } from '@/components/ui/sonner';
import { EditorToolbar } from '@/components/toolbar/EditorToolbar';
import { ExcalidrawCanvas } from '@/components/canvas/ExcalidrawCanvas';
import { LayersPanel } from '@/components/inspector/LayersPanel';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { useDraw } from '@/hooks/use-draw';
import { api } from '@/lib/api-client';
import type { Drawing, Tool, Presence, Op, Template, Viewport, Point, DrawingElement } from '@shared/types';
import { exportToSvg, exportToPng, generateOp } from '@/lib/drawing';
import { EmptyStateIllustration } from './EditorAssets';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { v4 as uuidv4 } from 'uuid';
import { MessageCircle, Send, Download } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
const initialDrawing: Drawing = { id: '', title: 'Untitled', elements: [], updatedAt: 0, ops: [], opVersion: 0, presences: [] };
const userId = `user-${uuidv4().slice(0, 4)}`;
interface ChatMessage { role: 'user' | 'ai'; text: string; }
export function HomePage() {
  const [activeTool, setActiveTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#f48018');
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [currentDrawingId, setCurrentDrawingId] = useState<string | null>(null);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [presences, setPresences] = useState<Presence[]>([]);
  const [showGrid, setShowGrid] = useState(false);
  const [enableSnapping, setEnableSnapping] = useState(true);
  const [showCollabBanner, setShowCollabBanner] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewportOffset, setViewportOffset] = useState<Point>({ x: 0, y: 0 });
  const { drawing, elements, setDrawing, undo, redo, canUndo, canRedo, createElement, createStroke, mergeRemoteOps, pendingOps, dispatchOp, setLocalCursor, selectedIds, onSelect, onDeselectAll, onDragMove, onResize } = useDraw(initialDrawing);
  const { width, height } = useWindowSize();
  const isMobile = useIsMobile();
  const viewport = useRef<Viewport>({ x: viewportOffset.x, y: viewportOffset.y, width, height });
  useEffect(() => { viewport.current = { x: viewportOffset.x, y: viewportOffset.y, width, height }; }, [width, height, viewportOffset]);
  const loadDrawing = useCallback(async (id: string) => {
    try {
      setLoadError(null);
      const loaded = await api<Drawing>(`/api/drawings/${id}`);
      setDrawing(loaded);
      setCurrentDrawingId(id);
      setViewportOffset({ x: 0, y: 0 });
      toast.success(`Loaded "${loaded.title}"`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load drawing.';
      toast.error(errorMessage);
      setLoadError(errorMessage);
      setCurrentDrawingId(null);
    }
  }, [setDrawing]);
  const loadDrawings = useCallback(async () => {
    try {
      setLoadError(null);
      const { items } = await api<{ items: Drawing[] }>('/api/drawings');
      setDrawings(items);
      if (!currentDrawingId && items.length > 0) {
        loadDrawing(items[0].id);
      } else if (items.length === 0) {
        setCurrentDrawingId(null);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load drawings list.';
      toast.error(errorMessage);
      setLoadError(errorMessage);
    }
  }, [currentDrawingId, loadDrawing]);
  const loadTemplates = useCallback(async () => {
    try {
      const loadedTemplates = await api<Template[]>('/api/templates');
      setTemplates(loadedTemplates);
    } catch (error) {
      toast.error('Failed to load templates.');
    }
  }, []);
  useEffect(() => {
    loadDrawings();
    loadTemplates();
  }, [loadDrawings, loadTemplates]);
  const createNewDrawing = async (templateId?: string) => {
    try {
      const template = templateId ? templates.find(t => t.id === templateId) : null;
      const newDrawingPayload = {
        title: template ? `${template.title} (Copy)` : 'New Drawing',
        elements: template ? template.elements : [],
      };
      const newDrawing = await api<Drawing>('/api/drawings', { method: 'POST', body: JSON.stringify(newDrawingPayload) });
      setDrawings(prev => [newDrawing, ...prev]);
      loadDrawing(newDrawing.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create new drawing.');
    }
  };
  const handleSave = useCallback(async (ops: Op[]) => {
    if (!currentDrawingId || ops.length === 0) return;
    try {
      await api(`/api/drawings/${currentDrawingId}/ops`, { method: 'POST', body: JSON.stringify(ops) });
      setDrawing({ ...drawing, opVersion: (drawing.opVersion || 0) + ops.length });
    } catch (error) {
      toast.error('Failed to save changes.');
    }
  }, [currentDrawingId, drawing, setDrawing]);
  useDebounce(() => { handleSave(pendingOps); }, 1500, [pendingOps, handleSave]);
  useInterval(() => {
    const poll = async () => {
      if (!currentDrawingId) return;
      try {
        const [remoteOps, remotePresences] = await Promise.all([
          api<Op[]>(`/api/drawings/${currentDrawingId}/ops?since=${drawing.opVersion || 0}`),
          api<Presence[]>(`/api/drawings/${currentDrawingId}/presence`),
        ]);
        if (remoteOps.length > 0) {
          mergeRemoteOps(remoteOps);
          setDrawing({ ...drawing, opVersion: (drawing.opVersion || 0) + remoteOps.length });
          setShowCollabBanner(true);
          setTimeout(() => setShowCollabBanner(false), 3000);
        }
        setPresences(remotePresences.filter(p => p.userId !== userId));
      } catch (error) {
        console.error("Polling failed:", error);
      }
    };
    poll();
  }, 2000);
  const handleCursorMove = useCallback((cursor: Point) => {
    setLocalCursor(cursor);
    if (currentDrawingId) {
      api(`/api/drawings/${currentDrawingId}/presence`, { method: 'POST', body: JSON.stringify({ userId, cursor }) }).catch(console.error);
    }
  }, [currentDrawingId, setLocalCursor]);
  const handleExport = async (drawingToExport: Drawing, format: 'svg' | 'png', resolution = '1x') => {
    try {
      const scale = resolution === '2x' ? 2 : 1;
      const exportWidth = (viewport.current.width || 1000) * scale;
      const exportHeight = (viewport.current.height || 1000) * scale;
      const svgString = exportToSvg(drawingToExport, exportWidth, exportHeight, viewportOffset);
      const filename = `${drawingToExport.title}.${format}`;
      if (format === 'svg') {
        const blob = new Blob([svgString], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
      } else {
        const dataUrl = await exportToPng(svgString, exportWidth, exportHeight);
        const a = document.createElement('a'); a.href = dataUrl; a.download = filename; a.click();
      }
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch (error) {
      toast.error('Export failed.');
    }
  };
  const handleUpdateElement = (id: string, updates: Partial<DrawingElement>) => {
    dispatchOp(generateOp('update', id, updates));
  };
  const handleDeleteElement = (id: string) => {
    dispatchOp(generateOp('delete', id));
  };
  const handleSendChatMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return;
    const userMessage: ChatMessage = { role: 'user', text: chatInput };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsChatLoading(true);
    try {
      const context = { elements, ops: pendingOps, viewport: viewport.current, userId };
      const res = await api<{ response: string }>('/api/ai-chat', { method: 'POST', body: JSON.stringify({ message: chatInput, context }) });
      const aiMessage: ChatMessage = { role: 'ai', text: res.response };
      setChatMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      const aiErrorMessage: ChatMessage = { role: 'ai', text: "Sorry, I couldn't connect to the assistant." };
      setChatMessages(prev => [...prev, aiErrorMessage]);
    } finally {
      setIsChatLoading(false);
    }
  };
  const onPan = useCallback((delta: Point) => {
    setViewportOffset(prev => ({ x: prev.x + delta.x, y: prev.y + delta.y }));
  }, []);
  const onRotate = useCallback((deltaAngle: number, id: string) => {
    const el = elements.find(e => e.id === id);
    if (el) {
      dispatchOp(generateOp('update', id, { angle: el.angle + deltaAngle }));
    }
  }, [elements, dispatchOp]);
  const onReorder = useCallback((reorderedElements: DrawingElement[]) => {
    dispatchOp(generateOp('reorder', undefined, reorderedElements));
  }, [dispatchOp]);
  useHotkeys('v', () => setActiveTool('select'));
  useHotkeys('p', () => setActiveTool('pen'));
  useHotkeys('r', () => setActiveTool('rectangle'));
  useHotkeys('o', () => setActiveTool('ellipse'));
  useHotkeys('l', () => setActiveTool('line'));
  useHotkeys('t', () => setActiveTool('text'));
  useHotkeys('h', () => setActiveTool('hand'));
  useHotkeys('e', () => setActiveTool('eraser'));
  useHotkeys('backspace, delete', () => { selectedIds.forEach(id => dispatchOp(generateOp('delete', id))); onDeselectAll(); });
  useHotkeys('mod+z', undo);
  useHotkeys('mod+shift+z', redo);
  useHotkeys('mod+s', (e) => { e.preventDefault(); handleSave(pendingOps); });
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
            <SheetTrigger asChild><Button variant="outline">My Drawings</Button></SheetTrigger>
            <SheetContent>
              <SheetHeader><SheetTitle>Your Drawings</SheetTitle></SheetHeader>
              <Button onClick={() => createNewDrawing()} className="w-full my-4">Create New</Button>
              <ScrollArea className="h-[calc(100%-100px)]">
                <div className="space-y-2">
                  {drawings.map(d => (
                    <div key={d.id} className="p-2 rounded-md hover:bg-accent cursor-pointer border flex justify-between items-center">
                      <div onClick={() => loadDrawing(d.id)} className="flex-1">
                        <p className="font-medium">{d.title}</p>
                        <p className="text-xs text-muted-foreground">Last updated: {new Date(d.updatedAt).toLocaleDateString()}</p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={async () => {
                        try {
                          const fullDrawing = await api<Drawing>(`/api/drawings/${d.id}`);
                          handleExport(fullDrawing, 'png');
                        } catch (e) { toast.error('Failed to fetch drawing for export.'); }
                      }}><Download className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>
        </header>
        <main className="flex-1 relative">
          <EditorToolbar
            activeTool={activeTool} onToolChange={setActiveTool} color={color} onColorChange={setColor}
            onUndo={undo} onRedo={redo} canUndo={canUndo} canRedo={canRedo}
            onSave={() => handleSave(pendingOps)} onExport={(format, res) => handleExport({ ...drawing, elements }, format, res)}
            showGrid={showGrid} onToggleGrid={() => setShowGrid(!showGrid)}
            enableSnapping={enableSnapping} onToggleSnapping={() => setEnableSnapping(!enableSnapping)}
            templates={templates} onLoadTemplate={(id) => createNewDrawing(id)}
          />
          <AnimatePresence>
            {showCollabBanner && (
              <motion.div
                className="fixed bg-primary text-primary-foreground px-4 py-2 rounded-full top-20 left-1/2 -translate-x-1/2 z-20 shadow-lg"
                initial={{ y: -100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -100, opacity: 0 }}
              >Drawing updated with remote changes!</motion.div>
            )}
          </AnimatePresence>
          <div className="absolute bottom-4 left-4 z-10 bg-card/80 backdrop-blur-sm p-2 rounded-lg text-xs text-muted-foreground">
            {presences.length + 1} user(s) online
          </div>
          <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 lg:px-8">
            <div className="py-4 md:py-6 lg:py-8 h-full">
              {currentDrawingId ? (
                <ResizablePanelGroup direction="horizontal" className="h-full rounded-lg border">
                  <ResizablePanel defaultSize={80}>
                    <ExcalidrawCanvas
                      elements={elements} tool={activeTool} color={color} strokeWidth={strokeWidth}
                      onCreateElement={createElement} onCreateStroke={createStroke} onUpdateElement={handleUpdateElement}
                      onDeleteElement={handleDeleteElement}
                      onCursorMove={handleCursorMove} presences={presences} showGrid={showGrid} enableSnapping={enableSnapping}
                      viewport={viewport.current} selectedIds={selectedIds} onSelect={onSelect} onDeselectAll={onDeselectAll}
                      onDragMove={onDragMove} onResize={onResize} onRotate={onRotate} onPan={onPan} isMobile={isMobile}
                    />
                  </ResizablePanel>
                  <ResizableHandle withHandle />
                  <ResizablePanel defaultSize={20} minSize={15} maxSize={25}>
                    <LayersPanel elements={elements} onDispatchOp={dispatchOp} onReorder={onReorder} />
                  </ResizablePanel>
                </ResizablePanelGroup>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-muted/50 rounded-lg">
                  <EmptyStateIllustration className="w-64 h-64" />
                  <h2 className="text-2xl font-semibold mt-4">Welcome to Paperplane</h2>
                  {loadError ? (
                    <>
                      <p className="text-destructive-foreground bg-destructive p-2 rounded-md">{loadError}</p>
                      <Button onClick={loadDrawings} className="mt-4">Retry</Button>
                    </>
                  ) : (
                    <>
                      <p className="text-muted-foreground">Create a new drawing or select one to get started.</p>
                      <Button onClick={() => createNewDrawing()} className="mt-6">Start Drawing</Button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
      {currentDrawingId && (
        <Sheet open={chatOpen} onOpenChange={setChatOpen}>
          <SheetContent>
            <SheetHeader><SheetTitle>Paperplane AI Assistant</SheetTitle></SheetHeader>
            <div className="h-full flex flex-col pt-4">
              <ScrollArea className="flex-1 -mx-6 px-6">
                <div className="space-y-4">
                  {chatMessages.map((msg, i) => (
                    <motion.div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                      <div className={`p-3 rounded-lg max-w-xs ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>{msg.text}</div>
                    </motion.div>
                  ))}
                  {isChatLoading && <motion.div className="flex justify-start" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><div className="p-3 rounded-lg bg-muted">...</div></motion.div>}
                </div>
              </ScrollArea>
              <div className="py-4 flex gap-2">
                <Input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()} placeholder="Ask for drawing tips..." />
                <Button onClick={handleSendChatMessage} disabled={isChatLoading}><Send className="h-4 w-4" /></Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      )}
      {!chatOpen && currentDrawingId && (
        <Button variant="secondary" size="icon" className="fixed bottom-4 right-4 z-50 rounded-full h-12 w-12 shadow-lg animate-bounce hover:animate-none" onClick={() => setChatOpen(true)}>
          <MessageCircle className="h-6 w-6" />
        </Button>
      )}
      <Toaster richColors closeButton />
    </AppLayout>
  );
}
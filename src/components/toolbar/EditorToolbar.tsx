import React from 'react';
import {
  MousePointer2,
  Pen,
  Square,
  Circle,
  Minus,
  Type,
  Eraser,
  Hand,
  Undo,
  Redo,
  Save,
  Download,
  Grid,
  Sparkles,
  LayoutTemplate,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Tool, Template } from '@shared/types';
import { HexColorPicker } from 'react-colorful';
interface EditorToolbarProps {
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
  color: string;
  onColorChange: (color: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onSave: () => void;
  onExport: (format: 'svg' | 'png', resolution?: string) => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  enableSnapping: boolean;
  onToggleSnapping: () => void;
  templates: Template[];
  onLoadTemplate: (id: string) => void;
}
const tools: { value: Tool; label: string; icon: React.ElementType }[] = [
  { value: 'select', label: 'Select', icon: MousePointer2 },
  { value: 'pen', label: 'Pen', icon: Pen },
  { value: 'rectangle', label: 'Rectangle', icon: Square },
  { value: 'ellipse', label: 'Ellipse', icon: Circle },
  { value: 'line', label: 'Line', icon: Minus },
  { value: 'text', label: 'Text', icon: Type },
];
export function EditorToolbar({
  activeTool,
  onToolChange,
  color,
  onColorChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onSave,
  onExport,
  showGrid,
  onToggleGrid,
  enableSnapping,
  onToggleSnapping,
  templates,
  onLoadTemplate,
}: EditorToolbarProps) {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
      <div className="p-2 rounded-lg shadow-lg bg-card border flex items-center gap-1.5 flex-wrap justify-center">
        <TooltipProvider>
          <ToggleGroup type="single" value={activeTool} onValueChange={(value: Tool) => value && onToolChange(value)}>
            {tools.map(({ value, label, icon: Icon }) => (
              <Tooltip key={value} delayDuration={0}>
                <TooltipTrigger asChild>
                  <ToggleGroupItem value={value} aria-label={label}>
                    <Icon className="h-4 w-4" />
                  </ToggleGroupItem>
                </TooltipTrigger>
                <TooltipContent><p>{label}</p></TooltipContent>
              </Tooltip>
            ))}
          </ToggleGroup>
          <Separator orientation="vertical" className="h-8 mx-1" />
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" className="w-8 h-8 transition-transform hover:scale-110" style={{ backgroundColor: color }} />
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 border-0"><HexColorPicker color={color} onChange={onColorChange} /></PopoverContent>
          </Popover>
          <Separator orientation="vertical" className="h-8 mx-1" />
          <Tooltip delayDuration={0}><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={onUndo} disabled={!canUndo}><Undo className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Undo</TooltipContent></Tooltip>
          <Tooltip delayDuration={0}><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={onRedo} disabled={!canRedo}><Redo className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Redo</TooltipContent></Tooltip>
          <Separator orientation="vertical" className="h-8 mx-1" />
          <Tooltip delayDuration={0}><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={onSave}><Save className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Save</TooltipContent></Tooltip>
          <Popover>
            <PopoverTrigger asChild><Button variant="ghost" size="icon"><Download className="h-4 w-4" /></Button></PopoverTrigger>
            <PopoverContent className="w-48">
              <div className="grid gap-4">
                <div className="space-y-2"><h4 className="font-medium leading-none">Export</h4><p className="text-sm text-muted-foreground">Download your drawing.</p></div>
                <Button variant="outline" onClick={() => onExport('svg')}>Export as SVG</Button>
                <div className="flex items-center gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => onExport('png', '1x')}>PNG</Button>
                  <Button variant="outline" className="flex-1" onClick={() => onExport('png', '2x')}>PNG (2x)</Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild><Button variant="ghost" size="icon"><LayoutTemplate className="h-4 w-4" /></Button></PopoverTrigger>
            <PopoverContent className="w-48">
              <div className="grid gap-2">
                <h4 className="font-medium leading-none">Templates</h4>
                {templates.map(t => <Button key={t.id} variant="ghost" onClick={() => onLoadTemplate(t.id)}>{t.title}</Button>)}
              </div>
            </PopoverContent>
          </Popover>
          <Separator orientation="vertical" className="h-8 mx-1" />
          <Tooltip delayDuration={0}><TooltipTrigger asChild><Button variant={showGrid ? 'secondary' : 'ghost'} size="icon" onClick={onToggleGrid}><Grid className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Toggle Grid</TooltipContent></Tooltip>
          <Tooltip delayDuration={0}><TooltipTrigger asChild><Button variant={enableSnapping ? 'secondary' : 'ghost'} size="icon" onClick={onToggleSnapping}><Sparkles className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Toggle Snapping</TooltipContent></Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
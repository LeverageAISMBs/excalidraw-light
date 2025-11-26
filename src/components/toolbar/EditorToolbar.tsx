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
  Share2,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Tool } from '@shared/types';
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
  onExport: (format: 'svg' | 'png') => void;
}
const tools: { value: Tool; label: string; icon: React.ElementType }[] = [
  { value: 'select', label: 'Select', icon: MousePointer2 },
  { value: 'pen', label: 'Pen', icon: Pen },
  { value: 'rectangle', label: 'Rectangle', icon: Square },
  { value: 'ellipse', label: 'Ellipse', icon: Circle },
  { value: 'line', label: 'Line', icon: Minus },
  { value: 'text', label: 'Text', icon: Type },
  { value: 'eraser', label: 'Eraser', icon: Eraser },
  { value: 'hand', label: 'Pan', icon: Hand },
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
}: EditorToolbarProps) {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
      <div className="p-2 rounded-lg shadow-lg bg-card border flex items-center gap-2">
        <TooltipProvider>
          <ToggleGroup type="single" value={activeTool} onValueChange={(value: Tool) => value && onToolChange(value)}>
            {tools.map(({ value, label, icon: Icon }) => (
              <Tooltip key={value}>
                <TooltipTrigger asChild>
                  <ToggleGroupItem value={value} aria-label={label}>
                    <Icon className="h-4 w-4" />
                  </ToggleGroupItem>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{label}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </ToggleGroup>
          <Separator orientation="vertical" className="h-8" />
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" style={{ backgroundColor: color }} className="w-8 h-8" />
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 border-0">
              <HexColorPicker color={color} onChange={onColorChange} />
            </PopoverContent>
          </Popover>
          <Separator orientation="vertical" className="h-8" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onUndo} disabled={!canUndo}>
                <Undo className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Undo</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onRedo} disabled={!canRedo}>
                <Redo className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Redo</TooltipContent>
          </Tooltip>
          <Separator orientation="vertical" className="h-8" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onSave}>
                <Save className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Save</TooltipContent>
          </Tooltip>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon">
                <Download className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-40">
              <div className="grid gap-2">
                <Button variant="ghost" onClick={() => onExport('svg')}>Export as SVG</Button>
                <Button variant="ghost" onClick={() => onExport('png')}>Export as PNG</Button>
              </div>
            </PopoverContent>
          </Popover>
        </TooltipProvider>
      </div>
    </div>
  );
}
import React from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { DrawingElement } from '@shared/types';
interface SortableItemProps {
  id: string;
  element: DrawingElement;
  children: React.ReactNode;
}
function SortableItem({ id, element, children }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} className="flex items-center gap-2 p-2 bg-background rounded-md touch-none">
      <Button variant="ghost" size="icon" className="cursor-grab" {...listeners}>
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </Button>
      {children}
    </div>
  );
}
interface LayersPanelProps {
  elements: DrawingElement[];
  onReorder: (elements: DrawingElement[]) => void;
  onToggleVisibility: (id: string) => void;
}
export function LayersPanel({ elements, onReorder, onToggleVisibility }: LayersPanelProps) {
  const sensors = useSensors(useSensor(PointerSensor));
  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = elements.findIndex((el) => el.id === active.id);
      const newIndex = elements.findIndex((el) => el.id === over.id);
      onReorder(arrayMove(elements, oldIndex, newIndex));
    }
  };
  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Layers</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={elements} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {elements.map((el) => (
                <SortableItem key={el.id} id={el.id} element={el}>
                  <span className="flex-1 text-sm truncate">{el.type}</span>
                  <Button variant="ghost" size="icon" onClick={() => onToggleVisibility(el.id)}>
                    {el.opacity === 0 ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </SortableItem>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </CardContent>
    </Card>
  );
}
import React from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable } from '@dnd-kit/sortable';
import { verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Eye, EyeOff, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { DrawingElement, Op } from '@shared/types';
import { generateOp } from '@/lib/drawing';
import { AnimatePresence, motion } from 'framer-motion';
interface SortableItemProps {
  id: string;
  children: React.ReactNode;
}
function SortableItem({ id, children }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...attributes}
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex items-center gap-2 p-2 bg-background rounded-md touch-none"
    >
      <Button variant="ghost" size="icon" className="cursor-grab" {...listeners}>
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </Button>
      {children}
    </motion.div>
  );
}
interface LayersPanelProps {
  elements: DrawingElement[];
  onDispatchOp: (op: Op) => void;
  onReorder: (elements: DrawingElement[]) => void;
}
export function LayersPanel({ elements, onDispatchOp, onReorder }: LayersPanelProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = elements.findIndex((el) => el.id === active.id);
      const newIndex = elements.findIndex((el) => el.id === over.id);
      onReorder(arrayMove(elements, oldIndex, newIndex));
    }
  };
  const handleToggleVisibility = (id: string) => {
    const el = elements.find(e => e.id === id);
    if (el) {
      onDispatchOp(generateOp('update', id, { opacity: el.opacity === 0 ? 1 : 0 }));
    }
  };
  const handleDelete = (id: string) => {
    onDispatchOp(generateOp('delete', id));
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
              <AnimatePresence>
                {elements.map((el) => (
                  <SortableItem key={el.id} id={el.id}>
                    <span className="flex-1 text-sm truncate">{el.type}</span>
                    <Button variant="ghost" size="icon" onClick={() => handleToggleVisibility(el.id)}>
                      {el.opacity === 0 ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(el.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </SortableItem>
                ))}
              </AnimatePresence>
            </div>
          </SortableContext>
        </DndContext>
      </CardContent>
    </Card>
  );
}
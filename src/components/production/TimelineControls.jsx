import React from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent } from '@/components/ui/card';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

export default function TimelineControls({ timelineRange, onTimelineChange }) {
  return (
    <Card className="bg-gradient-to-r from-white to-slate-50 border-slate-200">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <ZoomOut className="h-4 w-4 text-slate-600" />
            <Slider
              value={[timelineRange]}
              onValueChange={(value) => onTimelineChange(value[0])}
              min={7}
              max={90}
              step={1}
              className="w-40"
            />
            <ZoomIn className="h-4 w-4 text-slate-600" />
          </div>
          
          <div className="flex-1 flex items-center gap-2 justify-center">
            <span className="text-sm font-medium text-slate-700">
              {timelineRange} dias
            </span>
          </div>

          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onTimelineChange(30)}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Padrão
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
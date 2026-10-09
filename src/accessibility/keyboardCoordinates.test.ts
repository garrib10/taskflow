import { expect, it } from 'vitest';
import type { SensorContext } from '@dnd-kit/core';
import { keyboardCoordinates } from './keyboardCoordinates';
const rect = (left: number) => ({ left, top: 100, width: 320, height: 500, right: left + 320, bottom: 600 });
function context(over: string | null = 'todo'): SensorContext {
 return { over: over ? { id: over } : null, active: { data: { current: { status: 'todo' } } }, droppableRects: new Map([['todo',rect(0)],['in-progress',rect(344)],['in-review',rect(688)],['done',rect(1032)]]), collisionRect: { left:20,top:150,width:280,height:180 } } as unknown as SensorContext;
}
it('targets the adjacent column center from the current measured rectangle', () => {
 const event=new KeyboardEvent('keydown',{code:'ArrowRight',cancelable:true});expect(keyboardCoordinates(event,{active:'task',currentCoordinates:{x:20,y:150},context:context()})).toEqual({x:364,y:90});expect(event.defaultPrevented).toBe(true);
});
it('moves left using the current destination instead of the source task stage', () => {
 const c=context('in-review');c.collisionRect={...rect(700),top:150,width:280,height:180};expect(keyboardCoordinates(new KeyboardEvent('keydown',{code:'ArrowLeft'}),{active:'task',currentCoordinates:{x:700,y:150},context:c})).toEqual({x:364,y:90});
});
it('uses task status before the first collision is available', () => {
 expect(keyboardCoordinates(new KeyboardEvent('keydown',{code:'ArrowRight'}),{active:'task',currentCoordinates:{x:20,y:150},context:context(null)})).toEqual({x:364,y:90});
});
it.each(['ArrowUp','ArrowDown','ArrowLeft'])('ignores unsupported keys or the first-column boundary: %s', code => {
 expect(keyboardCoordinates(new KeyboardEvent('keydown',{code}),{active:'task',currentCoordinates:{x:0,y:0},context:context()})).toBeUndefined();
});
it('does not target beyond the last column or an unmeasured destination', () => {
 const c=context('done');expect(keyboardCoordinates(new KeyboardEvent('keydown',{code:'ArrowRight'}),{active:'task',currentCoordinates:{x:0,y:0},context:c})).toBeUndefined();c.over=null;c.droppableRects.clear();expect(keyboardCoordinates(new KeyboardEvent('keydown',{code:'ArrowRight'}),{active:'task',currentCoordinates:{x:0,y:0},context:c})).toBeUndefined();
});

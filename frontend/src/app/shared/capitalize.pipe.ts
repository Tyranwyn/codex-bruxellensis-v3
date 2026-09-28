import {Pipe, PipeTransform} from '@angular/core';

/** `FRENCH` → `French` */
@Pipe({name: 'capitalize'})
export class CapitalizePipe implements PipeTransform {
  transform(text: string): string {
    const lower = text.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }
}

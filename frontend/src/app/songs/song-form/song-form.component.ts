import {ChangeDetectionStrategy, Component, effect, inject, input, model, signal} from '@angular/core';
import {NonNullableFormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';

import {CapitalizePipe} from '../../shared/capitalize.pipe';
import {CATEGORIES, Category} from '../models/category';
import {Song, SongData} from '../models/song';
import {SongService} from '../song.service';

/** Modal to add a song (no `song` given) or edit/delete an existing one. Admins only. */
@Component({
  selector: 'app-song-form',
  imports: [ReactiveFormsModule, CapitalizePipe],
  templateUrl: './song-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SongFormComponent {
  private readonly songService = inject(SongService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly open = model(false);
  readonly song = input<Song | null>(null);

  readonly categories = CATEGORIES;
  readonly saving = signal(false);
  readonly form = this.fb.group({
    category: this.fb.control<Category | ''>('', Validators.required),
    page: this.fb.control<number | null>(null),
    title: '',
    bgInfo: '',
    lyrics: '',
    associationName: '',
    associationInfo: '',
    battleCryName: '',
    battleCryInfo: '',
    battleCry: ''
  });

  constructor() {
    // Refill the form each time the modal opens.
    effect(() => {
      if (this.open()) {
        const song = this.song();
        this.form.reset();
        if (song) {
          this.form.patchValue(song);
        }
      }
    });
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue() as SongData;
    const song = this.song();
    await this.run(() => song ? this.songService.update(song.id, value) : this.songService.add(value));
  }

  async delete(): Promise<void> {
    const song = this.song();
    if (song && confirm(`Delete "${song.title || song.associationName}"?`)) {
      await this.run(() => this.songService.delete(song.id));
    }
  }

  close(): void {
    this.open.set(false);
  }

  private async run(write: () => Promise<void>): Promise<void> {
    this.saving.set(true);
    try {
      await write();
      this.close();
    } catch (err) {
      alert(`Saving failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      this.saving.set(false);
    }
  }
}

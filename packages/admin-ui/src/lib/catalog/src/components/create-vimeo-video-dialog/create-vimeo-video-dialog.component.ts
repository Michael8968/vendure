import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
// import { Dialog } from '../../providers/modal/modal.types';

@Component({
    selector: 'vdr-create-vimeo-video-dialog',
    templateUrl: './create-vimeo-video-dialog.component.html',
    styleUrls: ['./create-vimeo-video-dialog.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateVimeoVideoDialogComponent implements OnInit {
    videoForm = this.formBuilder.group({
        name: ['', Validators.required],
        description: [''],
        link: ['', [Validators.required, Validators.pattern(/^https:\/\/vimeo\.com\/\d+(\?.*)?$/)]],
    });
    resolveWith: (result?: { name: string; description: string; url: string; }) => void;
    videoId$: Observable<string>;

    constructor(private formBuilder: FormBuilder) {}

    ngOnInit() {
        const linkControl = this.videoForm.get('link');
        this.videoId$ = linkControl ? linkControl.valueChanges.pipe(
            switchMap(url => {
                if (url) {
                    const match = url.match(/^https:\/\/vimeo\.com\/(\d+)/);
                    return of(match ? match[1] : '');
                }
                return of('');
            })
        ) : of('');
    }

    cancel() {
        this.resolveWith();
    }

    submit() {
        if (this.videoForm.valid) {
            // this.resolveWith(this.form.value);
        }
    }
}

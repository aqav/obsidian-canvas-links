import { App, Editor, ItemView, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, WorkspaceLeaf } from 'obsidian';

const VIEW_TYPE: string = "canvas-view"

export default class CanvasViewPlugin extends Plugin {

    onload(): void {
        console.log('load plugin') // enable plugin

        this.registerView(VIEW_TYPE, (leaf) => new CanvasView(leaf))

        this.addRibbonIcon("dice", "Load view", () => {
            this.onloadView();
        });
    }

    async onloadView(): Promise<void> {
        this.app.workspace.detachLeavesOfType(VIEW_TYPE);

        await this.app.workspace.getRightLeaf(false).setViewState({
            type: VIEW_TYPE,
            active: true,
        }); // view#onOpen()

        // this.app.workspace.revealLeaf(
        //     this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]
        // );
    }

    onunload(): void { 
        console.log('unload plugin'); // disable plugin

        this.app.workspace.detachLeavesOfType(VIEW_TYPE); // view#onClose()
    }
}

class CanvasView extends ItemView {

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType(): string {
        return VIEW_TYPE;
    }

    getDisplayText(): string {
        return "Canvas View";
    }

    async onOpen(): Promise<void> {
        this.registerEvent(this.app.workspace.on('file-open', () => {
            this.getCanvas().then((canvas) => {
                this.renderCanvas(canvas, this.containerEl);
            });
        }))
    }

    async getCanvas(): Promise<TFile[]> {
        console.log('get canvas')
        const activeFile: TFile | null = this.app.workspace.getActiveFile();
        if (activeFile == null) {
            return [];
        }

        const canvas: TFile[] = [];
        const files: TFile[] = this.app.vault.getFiles();
        for (const file of files) {
            if ('canvas' == file.extension) {
                canvas.push(file);
            }
        }

        const canvasContent: Map<TFile, string> = new Map<TFile, string>();
        for (const file of canvas) {
            await this.app.vault.read(file).then((content: string) => {
                canvasContent.set(file, content);
            });
        }

        const canvasEmebeded: TFile[] = [];
        for (const [file, content] of canvasContent) {
            const nodes: node[] = JSON.parse(content).nodes;
            for (const node of nodes) {
                if ('file' == node.type && activeFile.name == node.file) {
                    canvasEmebeded.push(file);
                }
            }
        }

        return canvasEmebeded;
    }

    renderCanvas(canvas: TFile[], container: Element): void {
        container.empty();

        const pane: HTMLDivElement = container.createDiv({
            cls: 'outgoing-link-pane node-insert-event',
            attr: { 'style': 'position: relative;' },
        });

        const header: HTMLDivElement = pane.createDiv({
            cls: 'tree-item-self is-clickable',
            attr: {
                'aria-label': 'Click to collapse',
                'aria-label-position': 'right'
            }
        });
        header.createSpan({ cls: 'tree-item-icon collapse-icon' }, (el) => {
            el.createSvg('svg', {
                attr: {
                    'xmlns': 'http://www.w3.org/2000/svg',
                    'width': '10',
                    'height': '10',
                    'viewBox': '0 0 24 24',
                    'fill': 'none',
                    'stroke': 'currentColor',
                    'stroke-width': '4',
                    'stroke-linecap': 'round',
                    'stroke-linejoin': 'round',
                    'cls': 'svg-icon right-triangle',
                }
            });
        });
        header.createDiv({
            cls: 'tree-item-inner',
            text: 'Canvas'
        });
        header.createDiv({ cls: 'tree-item-flair-outer' }, (el) => {
            el.createSpan({
                cls: 'tree-item-flair',
                text: canvas.length.toString()
            })
        });

        const content: HTMLDivElement = pane.createDiv({ cls: 'search-result-container' });
        content.createDiv({
            attr: {
                'style': 'width: 1px; height: 0.1px; margin-bottom: 0px;'
            }
        });
        for (const file of canvas) {
            content.createDiv({
                cls: 'tree-item-self is-clickable outgoing-link-item',
                attr: { 'draggable': true }
            }, (el) => {
                el.createSpan({ cls: 'tree-item-icon' }, (el) => {
                    el.createSvg('svg', {
                        attr: {
                            'xmlns': 'http://www.w3.org/2000/svg',
                            'width': '16',
                            'height': '16',
                            'viewBox': '0 0 24 24',
                            'fill': 'none',
                            'stroke': 'currentColor',
                            'stroke-width': '2',
                            'stroke-linecap': 'round',
                            'stroke-linejoin': 'round',
                            'cls': 'svg-icon lucide-link',
                        }
                    }, (el) => {
                        el.createSvg('path', {
                            attr: { 'd': 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71' }
                        });
                        el.createSvg('path', {
                            attr: { 'd': 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' }
                        });
                    });
                });
                el.createDiv({
                    cls: 'tree-item-inner',
                    text: file.name
                }).addEventListener('click', () => {
                    this.app.workspace.openLinkText('', file.path);
                });
            });
        }
    }

    async onClose(): Promise<void> {
        console.log('close view');
    }
}

type node = {
    type: string
    file: string
}
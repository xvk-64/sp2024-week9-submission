import {Mutex} from "async-mutex";

export type EventListener<TData> = {
    callback: (data: TData) => void | undefined;
    invokeOnce: boolean;
}

export class EventEmitter<TData> {
    protected _listeners: EventListener<TData>[] = [];

    private _eventQueue: TData[] = [];

    public dispatch(data: TData) {
        if (this._listeners.length === 0) {
            this._eventQueue.push(data);
            return;
        }

        this._listeners.forEach(listener => listener.callback(data));

        this._listeners = this._listeners.filter(listener => !listener.invokeOnce);
    }

    public addListener(listener: EventListener<TData>): void {
        this._listeners.push(listener);

        let front = this._eventQueue.shift();
        while (front != undefined) {
            this.dispatch(front);
            front = this._eventQueue.shift();
        }
    }
    public createListener(callback: (data: TData) => void | undefined, invokeOnce: boolean = false): EventListener<TData> {
        let listener = {callback: callback, invokeOnce: invokeOnce};
        this.addListener(listener);
        return listener;
    }

    public removeListener(listener: EventListener<TData>): void {
        this._listeners = this._listeners.filter(l => l !== listener);
    }
}

export type AsyncEventListener<TData> = {
    callback: (data: TData) => Promise<void>;
    invokeOnce: boolean;
}
export class EventQueue<TData> {
    protected _listeners: AsyncEventListener<TData>[] = [];
    private _dispatchQueue: Promise<any> = Promise.resolve();

    private _eventQueue: TData[] = [];

    private _mutex = new Mutex();

    public dispatchSync(data: TData) {
        this.dispatch(data).then();
    }

    public async dispatch(data: TData): Promise<void> {
        if (this._listeners.length === 0) {
            this._eventQueue.push(data);
            return;
        }
0
        await this._mutex.runExclusive(async () => {
            this._dispatchQueue = this._dispatchQueue.then(async () =>
                await Promise.all(this._listeners.map(listener => listener.callback(data)))
            );

            await this._dispatchQueue;
        })
    }

    public addListener(listener: AsyncEventListener<TData>): void {
        this._listeners.push(listener);

        let front = this._eventQueue.shift();
        while (front != undefined) {
            this.dispatch(front);
            front = this._eventQueue.shift();
        }
    }
    public createListener(callback: (data: TData) => Promise<void>, invokeOnce: boolean = false): AsyncEventListener<TData> {
        let listener = {callback: callback, invokeOnce: invokeOnce};
        this.addListener(listener);
        return listener;
    }

    public removeListener(listener: AsyncEventListener<TData>): void {
        this._listeners = this._listeners.filter(l => l !== listener);
    }
}
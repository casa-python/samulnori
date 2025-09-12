import threading

class ThreadManager:
    def __init__(self):
        self.threads = {}

    def register(self, name: str, thread: threading.Thread):
        self.threads[name] = thread

    def wake_all(self):
        for thread in self.threads.values():
            if hasattr(thread, "wake"):
                thread.wake()

    def get(self, name: str):
        return self.threads.get(name)

    def is_alive(self, name: str):
        t = self.threads.get(name)
        return t.is_alive() if t else False

thread_manager = ThreadManager()
#include <signal.h>
#include <stdlib.h>
#include <fcntl.h>
#include <stdio.h>
#include <sys/time.h>
#include <sys/wait.h>
#include <unistd.h>

int forkPid = -1;
bool inited = false;
bool shouldEnd = false;


int restartDelay = 1;
int lastStart = 0;

void exitHandler(int /*signum*/) {
	if(!shouldEnd) {
		printf("Graceful shutdown request...\n");
		shouldEnd = true;

		// This will send sigint to EVERYTHING, which is fine for me.
		kill(0, SIGTERM);
	}
}

void child() {
	shouldEnd = true;

	if(system("/srcds/linkLatest.sh") != 0) {
		exit(1);
	} else {
		// Exit the child process with the srcds exit code
		system("/srcds/runServer.sh");
		//exec("/srcds/runServer.sh");
	}
}

int parent() {
	if(!inited) {
		signal(SIGTERM, exitHandler);

		inited = true;
	}

	int Stat;
	waitpid(forkPid, &Stat, 0);
	if(WIFEXITED(Stat)) {
		printf("Server exited with code %i\n", WEXITSTATUS(Stat));
		return 0;
	} else {
		printf("Exiting\n");
	}

	return 1;
}

int execServer(void) {
	forkPid = fork();
	if(forkPid < 0) {
		printf("Fork failed\n");
		return 1;
	}

	if(forkPid == 0) {
		shouldEnd = true;
		child();
		return 0;
	}

	return parent();
}

struct timeval tv;

int main(int argc,char** argv) {
	while(!shouldEnd) {
    gettimeofday(&tv, NULL);

		lastStart = tv.tv_sec;

		if(execServer() != 0 || shouldEnd)
			break;

		gettimeofday(&tv, NULL);
		printf("Restarting in %i second(s)...\n", restartDelay);

		sleep(restartDelay);

		// Only when the server was up for at least 60 seconds we want to reset the restart delay
		if(tv.tv_sec - lastStart > 60) {
			restartDelay = 1;
		} else if(restartDelay < 32) {
			restartDelay *= 2;
		}
	}

	return 0;
}
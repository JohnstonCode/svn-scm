#!/bin/bash

set -eux

TARGETDIR="$1"
cd "$TARGETDIR"
if [ -e "foo" ] && [ -e "foorepo" ]; then
	echo "Repository already exists"
	exit 0
fi

SvnCommit() {
	local MESSAGE="$1"
	local USERNAME=${2:-Alice}
	svn ci --username "$USERNAME" -m "$MESSAGE"
}

svnadmin create foorepo
svn co "file://$(readlink -f foorepo)" foo
cd foo

svn mkdir trunk branches tags
SvnCommit 'initial'

( # create project
set -e
cd trunk
cat > Makefile << 'EOF'
.PHONY: libfoo exe
all: exe
libfoo:
	$(MAKE) -C libfoo
exe: libfoo
	$(MAKE) -C exe
EOF
mkdir libfoo exe
cat > libfoo/Makefile << 'EOF'
all:
	cc *.c -o libfoo.so -shared
EOF
echo 'const char* get_foo_string();' > libfoo/libfoo.h
cat > libfoo/libfoo.c << 'EOF'
const char* get_foo_string() {
	return "foooooo";
}
EOF
cat > exe/Makefile << 'EOF'
all:
	cc *.c -o foo -L ../libfoo/ -lfoo
EOF
cat > exe/foo.c << 'EOF'
#include <stdio.h>
#include "../libfoo/libfoo.h"

int main() {
	puts(get_foo_string());
}
EOF
svn add ./*
SvnCommit "$(echo -e 'Project created\nlibrary foo\nand exe')"
)

(
set -e
cd trunk
echo "// dummy comment" >> libfoo/libfoo.c
SvnCommit "add comment" Bob
echo 'const char* get_foo_string();' > libfoo/libfoo.h
cat > libfoo/libfoo.h << 'EOF'
#ifndef LIBFOO
#define LIBFOO
const char* get_foo_string();
#endif
EOF
SvnCommit "fix header" Bob
)

(
set -e
svn cp ^/trunk ^/branches/feature1 -m "create branch"
svn up
cd branches/feature1
echo "// another dummy comment" >> libfoo/libfoo.c
echo "# another dummy comment" >> libfoo/Makefile
SvnCommit "comment" Mark
svn mv exe/foo.c exe/exefoo.c
echo '// edited! ' >> exe/exefoo.c
SvnCommit "rename exe" Mark
)

(
set -e
cd trunk
echo "# Alice's comment" >> exe/Makefile
SvnCommit "comment by Alice"
)

(
set -e
cd branches/feature1
svn up
svn merge ^/trunk
SvnCommit "sync with trunk" Mark
)

(
set -e
cd trunk
svn up
svn merge ^/branches/feature1
SvnCommit "merge feature1 to trunk" Mark
svn rm ^/branches/feature1 -m "rm branch"
)

svn up

import os
import filecmp
import sys
from time import time
import uuid
import subprocess

codes = {200: 'Accepted', 404: 'Server Error',
         405: 'Wrong Answer',
         406: 'Compile Error',
         400: 'Runtime Error', 408: 'Time Limit Exceeded', 999: 'Wrong Answer'}


def compile(file, lang):
    if(lang == 'python3'):
        return 200
    if (os.path.isfile(file)):
        if lang == 'c':
            os.system('gcc -x c -Wall -O2 -static -pipe ' + file + ' -lm')
        elif lang == 'cpp':
            os.system(
                'g++ -x c++ -std=c++11 -Wall -O2 -static -pipe -fomit-frame-pointer ' + file)
        elif lang == 'java':
            os.system('javac -encoding UTF-8 -sourcepath . -d . ' + file)
        if (os.path.isfile('a.out')) or (os.path.isfile('main.class')):
            return 200
        else:
            return 406
    else:
        return 404


def run(file, input, timeout, lang):
    cmd = ''
    if lang == 'java':
        cmd += 'java main'
    elif lang == 'c' or lang == 'cpp':
        cmd += './a.out'
    elif lang == 'python3':
        cmd += 'python3 ' + file
    testcases = open(input, 'r').read().split("|||")
    expected_results = open(expected_result, 'r').read().split("|||")

    filename = "current_result"
    for i in range(len(testcases)):
        starttime = time()
        result = ""
        try:
            result = subprocess.check_output("timeout {} {}".format(
                timeout, cmd), universal_newlines=True, input=testcases[i], shell=True)
        except subprocess.CalledProcessError as e:
            if (e.returncode == 124):
                return 408
            return 400
        endtime = time()
        print((endtime-starttime)*1000)
        if (expected_results[i].strip() != result):
            print(result, expected_results[i])
            return 999
    return 200


def match(output):
    if os.path.isfile('out.txt') and os.path.isfile(output):
        b = filecmp.cmp('out.txt', output)
        os.remove('out.txt')
        return b
    else:
        return 404


params = sys.argv
file = params[1].split('/')[3]
path = os.getcwd()
folder = params[1].split('/')[2]
path = '../temp/' + folder + '/'

os.chdir(path)
lang = params[2]
timeout = str(min(15, int(params[3])))


testin = "input.txt"
testout = "output.txt"
expected_result = "expected_result.txt"
status = compile(file, lang)
if status == 200:
    status = run(file, testin, timeout, lang)
print(codes[status])

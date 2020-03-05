import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatPaginator, MatTableDataSource, MatSort } from '@angular/material';
import * as moment from 'moment';
import { forkJoin } from "rxjs/observable/forkJoin";
import { MainService } from '../../services/mainapp.service';
import { Socket } from 'ng-socket-io';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'producers-page',
  templateUrl: './producers.component.html',
  styleUrls: ['./producers.component.css']
})
export class ProducersPageComponent implements OnInit, OnDestroy{
  mainData;
  spinner = false;
  displayedColumns = ['#', 'Name', 'Status', 'Url', 'Location', 'Total Votes', 'Rate', 'Rewards'];
  dataSource;
  eosToInt = Math.pow(10, 13);
  totalProducerVoteWeight;
  sortedArray;
  votesToRemove;
  timeToUpdate = 6000;
  firstLoad = true;
  globalTableData;
  producer;
  filterVal = '';
  bpJson;
  globalTable;
  producers_cnt = 39;
  chainPercentage;
  chainNumber;
  frontConfig = environment.frontConfig;

  @ViewChild(MatPaginator) paginator: MatPaginator;

  constructor(private route: ActivatedRoute, protected http: HttpClient, private MainService: MainService, private socket: Socket){
  }

  getBlockData(){
      this.spinner   = (this.firstLoad) ? true : false;
  		let producers  = this.http.get(`/api/custom/get_table_rows/eosio/eosio/producers/${this.frontConfig.producers}`);
      let global     = this.http.get(`/api/v1/get_table_rows/eosio/eosio/global/1`);
      let bpInfo     = this.http.get(`/api/v1/get_producers_bp_json`);
      let token      = this.http.get(`/api/custom/get_table_rows/eosio.token/BET/stat/1`);

      forkJoin([producers, global, bpInfo, token])
  				 .subscribe(
                      (results: any) => {
                          this.totalProducerVoteWeight = Number(results[1].rows[0].total_producer_vote_weight);
                          this.bpJson = results[2];
                          this.globalTable = results[1];

                          this.producers_cnt = this.globalTable.rows[0].target_producer_schedule_size

                          this.getSupplyEOS(this.globalTable);
                          this.createTable(results[0], this.totalProducerVoteWeight, this.bpJson, results[1], results[3], results[0]);

                          this.socket.on('producers', (data) => {
                            if (!data) return;
                            console.trace(data)
                            this.createTable(data, this.totalProducerVoteWeight, this.bpJson, results[1], results[3], data);
                          });

                          this.spinner = false;
                      },
                      (error) => {
                          console.error(error);
                          this.spinner = false;
                      });
  };

  createTable(table, totalVotes, bpJson, globalTable, tokenTable, producersTable) {
      // table = /api/custom/get_table_rows/eosio/eosio/producers/
      // globalTable = /api/v1/get_table_rows/eosio/eosio/global/1
      if (this.filterVal.length > 0){
          return console.log('filter val');
      }
      this.mainData = table.rows;
      this.globalTableData = this.joinOtherProducerInfo(this.MainService.countRate(
        this.MainService.sortArray(this.mainData),
        totalVotes,
        globalTable,
        tokenTable,
        producersTable,
      ), bpJson);
      let ELEMENT_DATA: Element[] = this.globalTableData;
      this.dataSource = new MatTableDataSource<Element>(ELEMENT_DATA);
      this.dataSource.paginator = this.paginator;
  }

  joinOtherProducerInfo(sortedArr, joinArr){
      let result = [];
      let joinObj = {};
      if (!joinArr){
          return sortedArr;
      }
      joinArr.forEach(elem => {
           joinObj[elem.name] = {
              location: elem.location,
              image: elem.image
           };
      });
      sortedArr.forEach(elem => {
            if(joinObj[elem.owner]){
               elem.location = joinObj[elem.owner].location.toLowerCase();
               elem.image = joinObj[elem.owner].image;
            }
      });
      return sortedArr;
  }

  calculateTotalVotes(global, supply){
      if (!global || !global.rows || !global.rows[0] || !global.rows[0].total_activated_stake){
          return;
      }
      /*if(this.frontConfig.coin === 'WAX'){
          this.chainPercentage = (global.rows[0].total_activated_stake / 100000000 / supply * 100).toFixed(2);
          this.chainNumber = global.rows[0].total_activated_stake / supply * 100000;
      }*/
      this.chainPercentage = (global.rows[0].total_activated_stake / 10000 / supply * 100).toFixed(2);
      this.chainNumber = global.rows[0].total_activated_stake / supply * 100000;
  }

  getSupplyEOS(globalTable){
    this.http.get(`/api/custom/get_table_rows/eosio.token/${this.frontConfig.coin}/stat/1`)
             .subscribe((res: any) => {
                if (!res || !res.rows || !res.rows[0] || !res.rows[0].supply){
                    return;
                }
                this.calculateTotalVotes(globalTable, Number(res.rows[0].supply.split(" ")[0]));
             }, err => {
                console.log(err);
             });
  }

  applyFilter(filterValue: string) {
    this.filterVal = filterValue;
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }

  ngOnInit() {
     this.getBlockData();
     this.firstLoad = false;
     this.MainService.currentMessage.subscribe(message => this.producer = message);
  }
  ngOnDestroy() {
     this.socket.removeAllListeners('producers');
  }
}







